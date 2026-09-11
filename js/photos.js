/*
 * Fotos: normalização, redimensionamento e cache de preview.
 *
 * Foto de celular chega com 12 MP e EXIF. Sem tratamento, o PDF passa de
 * 100 MB e o navegador trava. O re-encode em canvas também descarta
 * geolocalização e modelo do aparelho, o que é bom para privacidade.
 */
window.GIRO = window.GIRO || {};

(function () {
  'use strict';

  var MAX_LADO_VEICULO = 1600;
  var MAX_LADO_RETRATO = 800;
  var QUALIDADE = 0.82;

  // id -> { blob, url, w, h }. url é objectURL para as miniaturas.
  var cache = new Map();

  function novoId() {
    return 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /** Decodifica respeitando a orientação EXIF, com fallback para <img>. */
  function decodificar(file) {
    if (typeof createImageBitmap === 'function') {
      return createImageBitmap(file, { imageOrientation: 'from-image' })
        .catch(function () { return viaImg(file); });
    }
    return viaImg(file);
  }

  function viaImg(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Imagem inválida')); };
      img.src = url;
    });
  }

  function redimensionar(bitmap, maxLado) {
    var w = bitmap.width || bitmap.naturalWidth;
    var h = bitmap.height || bitmap.naturalHeight;
    var escala = Math.min(1, maxLado / Math.max(w, h));
    var cw = Math.max(1, Math.round(w * escala));
    var ch = Math.max(1, Math.round(h * escala));

    var canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    // Fundo branco: JPEG não tem alfa e PNG transparente sairia preto.
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(bitmap, 0, 0, cw, ch);
    if (bitmap.close) { bitmap.close(); }

    return new Promise(function (resolve) {
      canvas.toBlob(function (blob) {
        resolve({ blob: blob, w: cw, h: ch });
      }, 'image/jpeg', QUALIDADE);
    });
  }

  /**
   * Processa um File e devolve o id já persistido no IndexedDB.
   * `tipo`: 'veiculo' (padrão) ou 'retrato'.
   */
  function adicionar(file, tipo) {
    var maxLado = tipo === 'retrato' ? MAX_LADO_RETRATO : MAX_LADO_VEICULO;
    return decodificar(file)
      .then(function (bmp) { return redimensionar(bmp, maxLado); })
      .then(function (r) {
        var id = novoId();
        cache.set(id, {
          blob: r.blob,
          url: URL.createObjectURL(r.blob),
          w: r.w,
          h: r.h
        });
        return GIRO.storage.salvarFoto(id, r.blob, r.w, r.h).then(function () { return id; });
      });
  }

  function url(id) {
    var e = cache.get(id);
    return e ? e.url : null;
  }

  /** Repovoa o cache a partir do IndexedDB (retomada de rascunho). */
  function reidratar() {
    return GIRO.storage.lerTodasFotos().then(function (registros) {
      registros.forEach(function (r) {
        if (cache.has(r.id)) { return; }
        cache.set(r.id, {
          blob: r.blob,
          url: URL.createObjectURL(r.blob),
          w: r.w,
          h: r.h
        });
      });
      return registros.length;
    });
  }

  function paraDataUrl(id) {
    var e = cache.get(id);
    var origem = e ? Promise.resolve(e.blob) : GIRO.storage.lerFoto(id).then(function (r) {
      return r ? r.blob : null;
    });
    return origem.then(function (blob) {
      if (!blob) { return null; }
      return new Promise(function (resolve, reject) {
        var fr = new FileReader();
        fr.onload = function () { resolve(fr.result); };
        fr.onerror = function () { reject(fr.error); };
        fr.readAsDataURL(blob);
      });
    });
  }

  function esquecer(ids) {
    (ids || []).forEach(function (id) {
      var e = cache.get(id);
      if (e) { URL.revokeObjectURL(e.url); cache.delete(id); }
    });
    return GIRO.storage.apagarFotos(ids);
  }

  function limparTudo() {
    cache.forEach(function (e) { URL.revokeObjectURL(e.url); });
    cache.clear();
  }

  GIRO.photos = {
    adicionar: adicionar,
    url: url,
    reidratar: reidratar,
    paraDataUrl: paraDataUrl,
    esquecer: esquecer,
    limparTudo: limparTudo
  };
})();
