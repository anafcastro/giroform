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

  // Fim de linha que encerra alguma coisa: frase, rótulo ("RELATO PM:") ou
  // item de lista. Quebra depois disso é intencional e fica.
  var FIM_DE_LINHA = /[.!?:;]["'”’)\]]*\s*$/;

  /**
   * Texto copiado de PDF (o B.O. chega assim) traz a quebra de cada linha do
   * original, no meio da frase. No laudo justificado isso vira uma linha
   * esticada seguida de duas palavras soltas. Linha que não termina em
   * pontuação continua na seguinte, com um espaço no lugar da quebra.
   */
  function juntarLinhas(p) {
    return p.split('\n').reduce(function (saida, linha) {
      linha = linha.trim();
      if (!linha) { return saida; }
      if (!saida) { return linha; }
      return saida + (FIM_DE_LINHA.test(saida) ? '\n' : ' ') + linha;
    }, '')
      // A mesma cópia separa palavras compostas: "evadiu- se", "GM/ CELTA".
      .replace(/(\p{L})([-\/]) (?=\p{L})/gu, '$1$2')
      // Digitado às pressas, falta o espaço depois da vírgula e do ponto:
      // "solicitante,uma", "colisão.solicita". No ponto, só entre palavras
      // de verdade, para não separar "b.o." nem "8.15242".
      .replace(/(\p{L}),(?=\p{L})/gu, '$1, ')
      .replace(/(\p{L}{3})\.(?=\p{L}{2})/gu, '$1. ');
  }

  /**
   * Parágrafos separados por linha em branco; os separadores ficam como
   * estão. Cada linha que sobra depois de juntar é tratada à parte, para um
   * rótulo em caixa alta numa linha própria não depender da frase seguinte.
   */
  function padronizar(texto) {
    return String(texto || '').replace(/\r/g, '').split(/(\n\s*\n)/).map(function (parte, i) {
      if (i % 2) { return parte; }
      return juntarLinhas(parte).split('\n').map(padronizarParagrafo).join('\n');
    }).join('');
  }

  GIRO.texto = {
    padronizar: padronizar
  };
})();
