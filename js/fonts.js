/*
 * Carga sob demanda das fontes do PDF.
 *
 * Barlow (grotesco de baixo contraste) nos títulos, para conversar com o
 * logotipo; BarlowCondensed nas faixas, onde os títulos são longos; Carlito
 * — métrica-compatível com Calibri — no corpo. Os arquivos foram reduzidos ao
 * latim (352 KB no total) e só são buscados na primeira geração de PDF.
 */
window.GIRO = window.GIRO || {};

(function () {
  'use strict';

  var ARQUIVOS = {
    'Barlow-Regular.ttf': 'assets/fonts/Barlow-Regular.ttf',
    'Barlow-Bold.ttf': 'assets/fonts/Barlow-Bold.ttf',
    'Barlow-Italic.ttf': 'assets/fonts/Barlow-Italic.ttf',
    'Barlow-BoldItalic.ttf': 'assets/fonts/Barlow-BoldItalic.ttf',
    'BarlowCondensed-Bold.ttf': 'assets/fonts/BarlowCondensed-Bold.ttf',
    'Carlito-Regular.ttf': 'assets/fonts/Carlito-Regular.ttf',
    'Carlito-Bold.ttf': 'assets/fonts/Carlito-Bold.ttf',
    'Carlito-Italic.ttf': 'assets/fonts/Carlito-Italic.ttf',
    'Carlito-BoldItalic.ttf': 'assets/fonts/Carlito-BoldItalic.ttf'
  };

  var DEFINICOES = {
    Barlow: {
      normal: 'Barlow-Regular.ttf',
      bold: 'Barlow-Bold.ttf',
      italics: 'Barlow-Italic.ttf',
      bolditalics: 'Barlow-BoldItalic.ttf'
    },
    // Só existe em negrito: é usada exclusivamente nas faixas de título.
    BarlowCondensed: {
      normal: 'BarlowCondensed-Bold.ttf',
      bold: 'BarlowCondensed-Bold.ttf',
      italics: 'BarlowCondensed-Bold.ttf',
      bolditalics: 'BarlowCondensed-Bold.ttf'
    },
    Carlito: {
      normal: 'Carlito-Regular.ttf',
      bold: 'Carlito-Bold.ttf',
      italics: 'Carlito-Italic.ttf',
      bolditalics: 'Carlito-BoldItalic.ttf'
    }
  };

  var pronto = null;

  function paraBase64(buffer) {
    var bytes = new Uint8Array(buffer);
    var binario = '';
    var CHUNK = 0x8000; // evita estourar o limite de argumentos de apply()
    for (var i = 0; i < bytes.length; i += CHUNK) {
      binario += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(binario);
  }

  /** Resolve quando pdfMake.vfs e pdfMake.fonts estiverem prontos. Idempotente. */
  function carregar() {
    if (pronto) { return pronto; }

    var nomes = Object.keys(ARQUIVOS);
    pronto = Promise.all(nomes.map(function (nome) {
      return fetch(ARQUIVOS[nome]).then(function (r) {
        if (!r.ok) { throw new Error('Falha ao carregar a fonte ' + nome + ' (' + r.status + ')'); }
        return r.arrayBuffer();
      });
    })).then(function (buffers) {
      pdfMake.vfs = pdfMake.vfs || {};
      buffers.forEach(function (buf, i) {
        pdfMake.vfs[nomes[i]] = paraBase64(buf);
      });
      pdfMake.fonts = DEFINICOES;
    }).catch(function (err) {
      pronto = null; // permite nova tentativa
      throw err;
    });

    return pronto;
  }

  GIRO.fonts = { carregar: carregar };
})();
