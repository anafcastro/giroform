/*
 * Padronização do texto corrido do laudo.
 *
 * Relatos e pareceres chegam colados de fontes diferentes — B.O., consultas,
 * outros laudos — e muitas vezes com trechos inteiros em caixa alta. A regra
 * é uma só: nenhuma frase toda em maiúsculas, e maiúscula só na primeira
 * letra de cada parágrafo e de cada frase.
 *
 * O trabalho é por frase, e não pelo texto inteiro, porque o mesmo relato
 * costuma misturar um trecho em caixa alta com outro já escrito normalmente
 * (e com nomes próprios em maiúsculas que devem ficar como estão).
 */
window.GIRO = window.GIRO || {};

(function () {
  'use strict';

  // Frase: tudo até um ., ! ou ? seguido de espaço (ou fim), com aspas e
  // parênteses de fechamento. "8.15240" e "B.O.X" não quebram, porque o
  // ponto não vem seguido de espaço.
  var FRASE = /[^]*?(?:[.!?]+["'”’)\]]*(?=\s|$)|$)/g;

  /** Tem letra e nenhuma minúscula. */
  function emCaixaAlta(s) {
    return /\p{L}/u.test(s) && s === s.toUpperCase() && s !== s.toLowerCase();
  }

  /**
   * Caixa alta para minúsculas, palavra a palavra. Palavra com algarismo —
   * placa, chassi, modelo como "HB20" ou "1.0M" — é código e fica como veio.
   */
  function minusculas(frase) {
    return frase.replace(/\S+/g, function (palavra) {
      return /\d/.test(palavra) ? palavra : palavra.toLowerCase();
    });
  }

  function primeiraMaiuscula(frase) {
    return frase.replace(/\p{L}/u, function (c) { return c.toUpperCase(); });
  }

  /**
   * Linhas de um mesmo parágrafo: texto copiado de PDF chega quebrado no meio
   * da frase, então a quebra simples não separa parágrafo — ela é tratada
   * como espaço na hora de achar as frases e preservada no resultado.
   */
  function padronizarParagrafo(p) {
    var saida = '';
    FRASE.lastIndex = 0;
    var m;
    while ((m = FRASE.exec(p)) !== null) {
      var frase = m[0];
      if (frase) {
        if (emCaixaAlta(frase)) { frase = minusculas(frase); }
        saida += primeiraMaiuscula(frase);
      }
      if (FRASE.lastIndex >= p.length) { break; }
      if (!m[0]) { FRASE.lastIndex++; }
    }
    return saida;
  }

  /** Parágrafos separados por linha em branco; os separadores ficam como estão. */
  function padronizar(texto) {
    return String(texto || '').replace(/\r/g, '').split(/(\n\s*\n)/).map(function (parte, i) {
      return i % 2 ? parte : padronizarParagrafo(parte);
    }).join('');
  }

  GIRO.texto = {
    padronizar: padronizar
  };
})();
