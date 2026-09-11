/*
 * Modelo de dados do laudo, em memória.
 *
 * As fotos NÃO ficam aqui: o estado guarda só os ids; os bytes vivem no
 * IndexedDB (storage.js) e o Blob/URL de preview em GIRO.photos.
 */
window.GIRO = window.GIRO || {};

(function () {
  'use strict';

  var SCHEMA = 2;   // 2: o parecer passou a ter fotos próprias

  function pessoaVazia() {
    return {
      fotoId: null,
      nome: '', mae: '', rg: '', cpf: '', nascimento: '',
      categoria: '', cnh: '', validade: '', renach: '', observacao: ''
    };
  }

  function veiculoVazio() {
    return {
      placa: '', proprietario: '',
      cpf: '', marca: '',
      renavam: '', furto: '',
      chassi: '', combustivel: '',
      anoFabModelo: '', cor: '',
      tipo: '', municipio: '',
      especie: '', categoria: '',
      motor: '', endereco: ''
    };
  }

  function terceiroVazio() {
    return {
      id: 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      dados: pessoaVazia(),
      veiculo: veiculoVazio(),
      relato: { texto: '', origem: '' },
      fotos: []
    };
  }

  function laudoVazio() {
    return {
      v: SCHEMA,
      associado: pessoaVazia(),
      veiculo: veiculoVazio(),
      bo: { numero: '', relato: '', emitidoEm: '' },
      terceiros: [],
      fotos: [],
      // `parecer.fotos` ilustra a descrição do fato; as demais seções são só texto.
      parecer: { descricao: '', fotos: [], observacao: '', ctb: '', conclusao: '' }
    };
  }

  // ---- acesso por caminho ("associado.nome") -------------------------------
  function get(obj, path) {
    return path.split('.').reduce(function (o, k) {
      return (o === null || o === undefined) ? undefined : o[k];
    }, obj);
  }

  function set(obj, path, value) {
    var keys = path.split('.');
    var last = keys.pop();
    var target = keys.reduce(function (o, k) {
      if (o[k] === null || o[k] === undefined) { o[k] = {}; }
      return o[k];
    }, obj);
    target[last] = value;
  }

  GIRO.state = {
    SCHEMA: SCHEMA,
    laudo: laudoVazio(),

    reset: function () { this.laudo = laudoVazio(); },

    /** Substitui o estado por um rascunho recuperado, descartando o incompatível. */
    hydrate: function (data) {
      if (!data || data.v !== SCHEMA) { return false; }
      this.laudo = Object.assign(laudoVazio(), data);
      return true;
    },

    novoTerceiro: function () {
      var t = terceiroVazio();
      this.laudo.terceiros.push(t);
      return t;
    },

    removerTerceiro: function (id) {
      var i = this.laudo.terceiros.findIndex(function (t) { return t.id === id; });
      if (i < 0) { return []; }
      var removido = this.laudo.terceiros.splice(i, 1)[0];
      // ids de foto órfãos, para o chamador apagar do IndexedDB
      return removido.fotos.concat(removido.dados.fotoId ? [removido.dados.fotoId] : []);
    },

    terceiro: function (id) {
      return this.laudo.terceiros.find(function (t) { return t.id === id; }) || null;
    },

    get: function (path) { return get(this.laudo, path); },
    set: function (path, value) { set(this.laudo, path, value); }
  };
})();
