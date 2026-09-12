/*
 * Identidade do laudo — FONTE ÚNICA.
 *
 * Cores e assets vêm do papel timbrado oficial da GIRO Pronta Reação: o
 * laranja foi amostrado do próprio logotipo e o grafite do bloco escuro da
 * faixa. Trocar qualquer coisa aqui muda tela e PDF ao mesmo tempo.
 */
window.GIRO = window.GIRO || {};

GIRO.brand = {
  // ---- Papel timbrado -----------------------------------------------------
  nome: 'GIRO PRONTA REAÇÃO',
  cnpj: '39.433.589/0001-57',
  telefones: ['(62) 99382-9700', '(41) 98704-0154'],

  // Logotipo com fundo transparente. Serve à tela e ao cabeçalho de cada
  // página do PDF — a faixa cheia do papel timbrado pesava demais impressa.
  // A altura sai da proporção da arte (322×155); trocar a imagem por outra de
  // proporção parecida dispensa qualquer ajuste no código.
  logo: 'assets/logo.png',

  // ---- Título do documento ------------------------------------------------
  documento: {
    titulo: 'LAUDO DE VISTORIA',
    subtitulo: 'Verificação e Constatação das Condições do Local'
  },

  // ---- Tokens de cor (usados pelo PDF e, como CSS vars, pela tela) --------
  cores: {
    ink: '#1F2426',          // texto principal
    inkSoft: '#5C6569',      // texto secundário
    band: '#22292C',         // faixa de título de bloco
    bandText: '#FFFFFF',
    bandSoft: '#E8E9EA',     // faixa de subtítulo (Parecer Técnico)
    bandSoftText: '#1F2426',
    accent: '#FA8706',       // laranja da marca
    accentText: '#1F2426',   // texto legível sobre o laranja
    rule: '#C9CDD0',         // bordas de tabela
    paper: '#FFFFFF'
  },

  // Aviso reproduzido literalmente do modelo original, ao final do parecer.
  avisoLgpd:
    'ESTAS INFORMAÇÕES SÃO CONFIDENCIAIS E DEVERÃO SER UTILIZADAS, ÚNICA E ' +
    'EXCLUSIVAMENTE, PARA ORIENTAÇÃO DAS TRANSAÇÕES COMERCIAIS DA CONTRATANTE, ' +
    'RESPONSABILIZANDO-SE CIVIL E CRIMINALMENTE POR DANOS QUE OCASIONAR A ' +
    'TERCEIROS, QUANDO UTILIZADAS EM DESACORDO COM A LEGISLAÇÃO EM VIGOR. É ' +
    'VEDADO DA DIVULGAÇÃO DESTE LAUDO PARA TERCEIROS, E A UTILIZAÇÃO DOS DADOS ' +
    'RESPEITARÁ AS FINALIDADES E PROCEDIMENTOS LEGALMENTE ADMITIDOS PELA LEI Nº ' +
    '13.709, DE 14 DE AGOSTO DE 2018, GERAL DE PROTEÇÃO DE DADOS. A CONTRATANTE ' +
    'TEM 30 DIAS PARA A SOLICITAÇÃO DE UM LAUDO COMPLEMENTAR, CASO HAJA NECESSIDADE.'
};

// Publica os tokens como CSS custom properties, para o tema da tela.
(function applyCssTokens() {
  var root = document.documentElement;
  var c = GIRO.brand.cores;
  Object.keys(c).forEach(function (k) {
    root.style.setProperty('--giro-' + k, c[k]);
  });
})();
