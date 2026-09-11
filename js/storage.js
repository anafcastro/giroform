/*
 * Rascunho efêmero no aparelho.
 *
 * Existe por um motivo só: sobreviver a um refresh acidental no meio da
 * vistoria. Some sozinho após 1 hora sem alteração e é destruído assim que o
 * PDF é gerado. Nada aqui sai do aparelho.
 */
window.GIRO = window.GIRO || {};

(function () {
  'use strict';

  var LS_KEY = 'giro-laudo:v1:draft';
  var DB_NAME = 'giro-laudo';
  var DB_STORE = 'fotos';
  var TTL_MS = 60 * 60 * 1000;      // 1 hora, deslizante
  var AVISO_MS = 55 * 60 * 1000;    // faixa de aviso aos 55 min

  var dbPromise = null;

  function openDb() {
    if (dbPromise) { return dbPromise; }
    dbPromise = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(DB_STORE)) {
          db.createObjectStore(DB_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return dbPromise;
  }

  function tx(mode, fn) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(DB_STORE, mode);
        var store = t.objectStore(DB_STORE);
        var out = fn(store);
        t.oncomplete = function () { resolve(out && out.result !== undefined ? out.result : out); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error); };
      });
    });
  }

  // ---- fotos ---------------------------------------------------------------
  function salvarFoto(id, blob, w, h) {
    return tx('readwrite', function (s) { s.put({ id: id, blob: blob, w: w, h: h }); });
  }

  function lerFoto(id) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var req = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(id);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function lerTodasFotos() {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var req = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).getAll();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function apagarFotos(ids) {
    if (!ids || !ids.length) { return Promise.resolve(); }
    return tx('readwrite', function (s) { ids.forEach(function (id) { s.delete(id); }); });
  }

  // ---- rascunho ------------------------------------------------------------
  function meta() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  var salvarTimer = null;

  /** Grava com debounce e renova a janela de 1 hora. */
  function salvar(laudo) {
    clearTimeout(salvarTimer);
    salvarTimer = setTimeout(function () {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({
          updatedAt: Date.now(),
          laudo: laudo
        }));
      } catch (e) {
        // Cota estourada ou modo privado: o rascunho é opcional, seguimos sem ele.
        console.warn('Rascunho não pôde ser salvo:', e && e.name);
      }
    }, 400);
  }

  function carregar() {
    var m = meta();
    if (!m || !m.laudo) { return null; }
    if (Date.now() - m.updatedAt > TTL_MS) { return null; }
    return m;
  }

  function tocar() {
    var m = meta();
    if (!m) { return; }
    m.updatedAt = Date.now();
    try { localStorage.setItem(LS_KEY, JSON.stringify(m)); } catch (e) { /* ignorado */ }
  }

  function restaMs() {
    var m = meta();
    if (!m) { return Infinity; }
    return TTL_MS - (Date.now() - m.updatedAt);
  }

  function expirou() {
    var m = meta();
    return !!m && (Date.now() - m.updatedAt > TTL_MS);
  }

  function perto() {
    var m = meta();
    return !!m && (Date.now() - m.updatedAt > AVISO_MS);
  }

  /**
   * Único caminho de limpeza do app — usado pela expiração, pelos botões
   * "Novo laudo" / "Apagar rascunho" e pelo sucesso da geração do PDF.
   */
  function wipeAll() {
    clearTimeout(salvarTimer);
    try { localStorage.removeItem(LS_KEY); } catch (e) { /* ignorado */ }
    return tx('readwrite', function (s) { s.clear(); })
      .catch(function () { /* banco ausente é o estado desejado */ });
  }

  GIRO.storage = {
    salvar: salvar,
    carregar: carregar,
    tocar: tocar,
    expirou: expirou,
    perto: perto,
    restaMs: restaMs,
    salvarFoto: salvarFoto,
    lerFoto: lerFoto,
    lerTodasFotos: lerTodasFotos,
    apagarFotos: apagarFotos,
    wipeAll: wipeAll
  };
})();
