/*
 * Montagem do PDF (pdfmake).
 *
 * Margens fixas e idênticas em todas as páginas; cabeçalho da marca no topo e
 * numeração no rodapé de cada uma. O layout é próprio — não replica o modelo
 * em Word; dele vem apenas a estrutura de blocos e os campos.
 */
window.GIRO = window.GIRO || {};

(function () {
  'use strict';

  var LARGURA_PAGINA = 595.28;            // A4 retrato
  var ALTURA_PAGINA = 841.89;
  var LARGURA_UTIL = LARGURA_PAGINA - 80;  // menos 40 pt de cada lado
  var MARGENS = [40, 92, 40, 58];
  var ALTURA_UTIL = ALTURA_PAGINA - MARGENS[1] - MARGENS[3];

  var C = function () { return GIRO.brand.cores; };

  // ---- layouts de tabela ---------------------------------------------------
  var layoutFaixa = {
    hLineWidth: function () { return 0; },
    vLineWidth: function () { return 0; },
    paddingLeft: function () { return 8; },
    paddingRight: function () { return 8; },
    paddingTop: function () { return 5; },
    paddingBottom: function () { return 5; }
  };

  function layoutGrade() {
    var cor = C().rule;
    return {
      hLineWidth: function () { return 0.6; },
      vLineWidth: function () { return 0.6; },
      hLineColor: function () { return cor; },
      vLineColor: function () { return cor; },
      paddingLeft: function () { return 6; },
      paddingRight: function () { return 6; },
      paddingTop: function () { return 4; },
      paddingBottom: function () { return 4; }
    };
  }

  // ---- datas ---------------------------------------------------------------
  // Os campos vêm dos inputs nativos em ISO; o laudo é lido em pt-BR.
  function dataBr(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '');
    return m ? m[3] + '/' + m[2] + '/' + m[1] : (v || '');
  }

  function dataHoraBr(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v || '');
    return m ? m[3] + '/' + m[2] + '/' + m[1] + ' às ' + m[4] + ':' + m[5] : (v || '');
  }

  // ---- blocos --------------------------------------------------------------
  function faixa(texto, opcoes) {
    var no = {
      table: {
        widths: ['*'],
        body: [[{
          text: texto,
          font: 'BarlowCondensed',
          bold: true,
          fontSize: 14,
          characterSpacing: 0.4,
          color: C().bandText,
          alignment: 'center',
          fillColor: C().band
        }]]
      },
      layout: layoutFaixa,
      margin: [0, 0, 0, 8]
    };
    return Object.assign(no, opcoes || {});
  }

  function subfaixa(texto) {
    return {
      table: {
        widths: ['*'],
        body: [[{
          text: texto,
          font: 'Barlow',
          bold: true,
          fontSize: 11,
          characterSpacing: 0.3,
          color: C().bandSoftText,
          fillColor: C().bandSoft
        }]]
      },
      layout: layoutFaixa,
      margin: [0, 10, 0, 6]
    };
  }

  /** "Rótulo: valor" — o rótulo é impresso mesmo sem valor (decisão 8). */
  function campo(rotulo, valor, destaque) {
    return {
      text: [
        { text: rotulo + ': ', color: C().ink },
        { text: valor || '', bold: !!destaque, color: C().ink }
      ],
      font: 'Carlito',
      fontSize: 10,
      margin: [0, 1.5, 0, 1.5]
    };
  }

  var CAMPOS_PESSOA = [
    ['Nome', 'nome'], ['Mãe', 'mae'], ['RG', 'rg'], ['CPF', 'cpf'],
    ['Data Nascimento', 'nascimento', 'data'], ['Categoria', 'categoria'], ['CNH', 'cnh'],
    ['Validade', 'validade', 'data'], ['Renach', 'renach'], ['Observação', 'observacao']
  ];

  function blocoPessoa(pessoa, fotoDataUrl) {
    var celulaFoto = fotoDataUrl
      ? { image: fotoDataUrl, fit: [126, 186], alignment: 'center' }
      : {
          text: 'Sem foto',
          font: 'Carlito',
          fontSize: 9,
          color: C().inkSoft,
          alignment: 'center',
          margin: [0, 80, 0, 80]
        };

    var dados = CAMPOS_PESSOA.map(function (c) {
      var valor = c[2] === 'data' ? dataBr(pessoa[c[1]]) : pessoa[c[1]];
      return campo(c[0], valor, c[1] === 'nome');
    });

    return {
      table: {
        widths: [150, '*'],
        body: [[celulaFoto, { stack: dados }]]
      },
      layout: layoutGrade(),
      margin: [0, 0, 0, 14]
    };
  }

  var LINHAS_VEICULO = [
    ['Placa', 'placa', 'Proprietário', 'proprietario'],
    ['CPF', 'cpf', 'Marca', 'marca'],
    ['Renavam', 'renavam', 'Furto', 'furto'],
    ['Chassi', 'chassi', 'Combustível', 'combustivel'],
    ['Ano de Fabricação/ Modelo', 'anoFabModelo', 'Cor', 'cor'],
    ['Tipo', 'tipo', 'Município', 'municipio'],
    ['Espécie', 'especie', 'Categoria', 'categoria'],
    ['Nº do motor', 'motor', 'Endereço', 'endereco']
  ];

  var DESTAQUE_VEICULO = { placa: true, proprietario: true, marca: true };

  function blocoVeiculo(v) {
    var body = LINHAS_VEICULO.map(function (l) {
      return [
        campo(l[0], v[l[1]], DESTAQUE_VEICULO[l[1]]),
        campo(l[2], v[l[3]], DESTAQUE_VEICULO[l[3]])
      ];
    });
    return {
      table: { widths: ['*', '*'], body: body, dontBreakRows: true },
      layout: layoutGrade(),
      margin: [0, 0, 0, 14]
    };
  }

  var RECUO_PARAGRAFO = 24;   // entrada da primeira linha, como em texto corrido
  var ENTRELINHA = 1.45;

  /**
   * Palavra com hífen ou barra ("deslocou-se", "GM/CELTA") vai inteira.
   * O pdfmake parte a palavra ali e, no justificado, reparte a sobra da
   * linha entre os pedaços, o que abria um espaço falso no meio dela. O
   * espaço que segue a palavra vai junto, para não virar um pedaço à parte.
   */
  var COMPOSTA = /(\S*[\p{L}\d][-\/][\p{L}\d]\S* *)/u;

  function semCorteNaPalavra(texto) {
    // split com grupo de captura: os pedaços ímpares são as compostas
    return texto.split(COMPOSTA).map(function (pedaco, i) {
      return i % 2 ? { text: pedaco, noWrap: true } : pedaco;
    }).filter(function (pedaco) { return pedaco.text || pedaco; });
  }

  function paragrafos(texto, opcoes) {
    var o = opcoes || {};
    // Todo texto corrido passa pela mesma regra de maiúsculas antes de virar
    // PDF, colado ou digitado, de rascunho novo ou antigo.
    var blocos = GIRO.texto.padronizar(texto).split(/\n{2,}/).filter(function (p) {
      return p.trim().length;
    });
    if (!blocos.length) { return [{ text: '', font: 'Carlito', fontSize: 10 }]; }
    return blocos.map(function (p) {
      return {
        text: semCorteNaPalavra(p.trim()),
        font: 'Carlito',
        fontSize: o.fontSize || 10.5,
        alignment: o.alignment || 'justify',
        // Recuo na primeira linha e entrelinha folgada: o parecer é lido
        // inteiro, não consultado campo a campo como os blocos de dados.
        leadingIndent: RECUO_PARAGRAFO,
        lineHeight: ENTRELINHA,
        margin: [0, 0, 0, 7]
      };
    });
  }

  /** Relato em caixa: corpo + rodapé (data/origem) numa linha separada. */
  function blocoRelato(cabecalho, corpo, rodape) {
    var pilha = [];
    if (cabecalho) {
      pilha.push({ text: cabecalho, font: 'Carlito', bold: true, fontSize: 10, margin: [0, 0, 0, 6] });
    }
    pilha = pilha.concat(paragrafos(corpo, { fontSize: 10 }));

    var body = [[{ stack: pilha }]];
    if (rodape) {
      body.push([{ text: rodape, font: 'Barlow', bold: true, fontSize: 10 }]);
    }
    return {
      table: { widths: ['*'], body: body },
      layout: layoutGrade(),
      margin: [0, 0, 0, 14]
    };
  }

  /**
   * Uma foto por página; a faixa de título entra só antes da primeira. Conta
   * as páginas geradas para o chamador saber se precisa recomeçar em folha
   * limpa. O contador é das fotos realmente carregadas, não do índice do
   * array: uma foto que falhe ao ler não pode levar embora o título do bloco.
   */
  function blocoFotos(titulo, ids, mapa, conteudo) {
    var paginas = 0;
    ids.forEach(function (id) {
      var dataUrl = mapa[id];
      if (!dataUrl) { return; }
      var primeira = paginas === 0;
      if (primeira) {
        conteudo.push(faixa(titulo, { pageBreak: 'before' }));
      }
      conteudo.push({
        image: dataUrl,
        fit: [LARGURA_UTIL, primeira ? ALTURA_UTIL - 46 : ALTURA_UTIL - 6],
        alignment: 'center',
        margin: [0, 4, 0, 0],
        pageBreak: primeira ? undefined : 'before'
      });
      paginas += 1;
    });
    return paginas;
  }

  // ---- cabeçalho e rodapé --------------------------------------------------

  /*
   * Dois cabeçalhos. O da primeira página é maior, para a folha de abertura
   * apresentar a empresa e o documento; as seguintes usam o compacto, que não
   * rouba espaço do conteúdo.
   *
   * O grande não pode ir pelo `header`: o pdfmake monta o cabeçalho dentro de
   * um bloco da altura da margem superior (a mesma em todas as páginas, que
   * ele não deixa variar) e descarta o que passa disso — foi assim que o fio
   * da capa desapareceu na primeira tentativa. Então a capa é desenhada no
   * `background`, que recebe a folha inteira, e o primeiro bloco do laudo
   * desce por RECUO_CAPA para não encostar nela.
   */
  var LOGO_LARGURA = 66;
  var LOGO_LARGURA_CAPA = 118;
  var RECUO_CAPA = 28;
  var PROPORCAO_LOGO = 337 / 800;   // usada só quando a arte não pôde ser medida

  /** Filete do cabeçalho e do rodapé: um traço laranja curto e o resto em fio fino. */
  function filete(deslocamentoY) {
    return {
      canvas: [
        {
          type: 'line', x1: 0, y1: 0, x2: 34, y2: 0,
          lineWidth: 1, lineColor: C().accent
        },
        {
          type: 'line', x1: 34, y1: 0, x2: LARGURA_UTIL, y2: 0,
          lineWidth: 0.5, lineColor: C().rule
        }
      ],
      margin: [0, deslocamentoY, 0, 0]
    };
  }

  /**
   * Cabeçalho de toda página: logotipo à esquerda, título do documento à
   * direita e um fio separando do corpo. Sem a imagem (falha de rede, arte
   * ausente), o nome da empresa entra no lugar do logotipo, em vez de deixar
   * o laudo sem identificação.
   */
  /** Par título/subtítulo à direita, nos dois tamanhos. */
  function tituloDoDocumento(largura, corpo, corpoSub, descida, espacado) {
    var b = GIRO.brand;
    return {
      width: largura,
      margin: [0, descida, 0, 0],
      stack: [
        {
          text: b.documento.titulo,
          font: 'BarlowCondensed',
          bold: true,
          fontSize: corpo,
          characterSpacing: espacado ? 1.6 : 1.1,
          color: C().ink,
          alignment: 'right'
        },
        {
          text: b.documento.subtitulo,
          font: 'Carlito',
          fontSize: corpoSub,
          color: C().inkSoft,
          alignment: 'right',
          margin: [0, espacado ? 2 : 1, 0, 0]
        }
      ]
    };
  }

  /**
   * Coluna da marca. O logotipo vai embrulhado num stack porque, solto numa
   * coluna, o `width` dele seria lido como largura da coluna. O nome da
   * empresa entra no lugar quando a arte não carrega, em vez de deixar o laudo
   * sem identificação.
   */
  function colunaDaMarca(logo, o) {
    return logo
      ? { width: o.largura, stack: [{ svg: logo.cor, width: o.largura }] }
      : {
          // Na capa a largura é fixa: posicionado em absoluto, o 'auto' mede
          // curto demais e empurra a coluna do título para fora da folha.
          width: o.larguraSemLogo || 'auto',
          text: GIRO.brand.nome,
          font: 'Barlow',
          bold: true,
          fontSize: o.corpoNome,
          characterSpacing: 0.4,
          color: C().ink,
          margin: [0, o.descidaNome, 0, 0]
        };
  }

  /** Centra o título na altura do logotipo. */
  function descidaDoTitulo(alturaLogo, corpo, corpoSub) {
    return Math.max(0, (alturaLogo - (corpo * 1.2 + corpoSub * 1.25)) / 2);
  }

  /** Cabeçalho das páginas 2 em diante, pelo `header` do documento. */
  function cabecalhoCompacto(logo) {
    var alturaLogo = logo ? LOGO_LARGURA * logo.proporcao : 0;

    return {
      margin: [MARGENS[0], 30, MARGENS[2], 0],
      stack: [
        {
          columnGap: 14,
          columns: [
            colunaDaMarca(logo, { largura: LOGO_LARGURA, corpoNome: 11.5, descidaNome: 9 }),
            tituloDoDocumento('*', 13, 7.5, descidaDoTitulo(alturaLogo, 13, 7.5), false)
          ]
        },
        filete(11)
      ]
    };
  }

  /**
   * Cabeçalho da primeira página, desenhado no fundo. As larguras são
   * explícitas porque, posicionado em absoluto, o nó não herda a área útil.
   */
  function cabecalhoDaCapa(logo) {
    var alturaLogo = LOGO_LARGURA_CAPA * (logo ? logo.proporcao : PROPORCAO_LOGO);
    var larguraTexto = LARGURA_UTIL - LOGO_LARGURA_CAPA - 14;

    return {
      absolutePosition: { x: MARGENS[0], y: 28 },
      stack: [
        {
          columnGap: 14,
          columns: [
            colunaDaMarca(logo, {
              largura: LOGO_LARGURA_CAPA,
              larguraSemLogo: LOGO_LARGURA_CAPA,
              corpoNome: 14,
              descidaNome: 10
            }),
            tituloDoDocumento(larguraTexto, 25, 10.5, descidaDoTitulo(alturaLogo, 25, 10.5), true)
          ]
        },
        filete(14)
      ]
    };
  }

  function cabecalho(logo) {
    return function (pagina) {
      // A capa é desenhada no fundo; aqui só as páginas seguintes.
      return pagina === 1 ? null : cabecalhoCompacto(logo);
    };
  }

  var MARCA_DAGUA_LARGURA = 340;
  var BORDA_X = 26;                        // fio lateral, 14 pt fora do texto
  var BORDA_FOLGA = 26;                    // recuo no topo e no pé

  /**
   * Fundo de toda página: os fios laterais e a marca d'água.
   *
   * Vai como `background`, então fica atrás de tudo — inclusive das faixas de
   * título — e se repete em todas as páginas sem entrar no fluxo do conteúdo.
   * Os fios são só a sugestão de uma margem: finos e na cor das bordas de
   * tabela, para emoldurar sem virar enfeite.
   */
  function fundo(logo) {
    var linhas = [
      {
        type: 'line',
        x1: BORDA_X, y1: BORDA_FOLGA, x2: BORDA_X, y2: ALTURA_PAGINA - BORDA_FOLGA,
        lineWidth: 0.7, lineColor: C().rule
      },
      {
        type: 'line',
        x1: LARGURA_PAGINA - BORDA_X, y1: BORDA_FOLGA,
        x2: LARGURA_PAGINA - BORDA_X, y2: ALTURA_PAGINA - BORDA_FOLGA,
        lineWidth: 0.7, lineColor: C().rule
      }
    ];

    var temMarca = !!(logo && logo.cinza);
    var alturaMarca = MARCA_DAGUA_LARGURA * (temMarca ? logo.proporcao : 0);

    return function (pagina) {
      var nos = [{ canvas: linhas, absolutePosition: { x: 0, y: 0 } }];
      if (pagina === 1) { nos.push(cabecalhoDaCapa(logo)); }
      if (temMarca) {
        nos.push({
          svg: logo.cinza,
          width: MARCA_DAGUA_LARGURA,
          absolutePosition: {
            x: (LARGURA_PAGINA - MARCA_DAGUA_LARGURA) / 2,
            y: (ALTURA_PAGINA - alturaMarca) / 2
          }
        });
      }
      return nos;
    };
  }

  /*
   * Aviso de confidencialidade: só na última página, dentro do rodapé —
   * abaixo do fio e acima da linha do CNPJ e da numeração.
   *
   * O pdfmake corta o que passa da altura da margem inferior, e o aviso não
   * cabe nela. Na última página o rodapé então começa mais acima, pela altura
   * do aviso, e a linha do CNPJ continua no lugar de sempre. ALTURA_AVISO é a
   * altura que o texto ocupa na largura útil; trocar o texto ou a fonte pede
   * conferir esse número.
   */
  var ALTURA_AVISO = 45;                   // cinco linhas de 9 pt
  var FOLGA_AVISO = 5;                     // entre o aviso e a linha do CNPJ

  function aviso() {
    return {
      text: GIRO.brand.avisoLgpd,
      font: 'Barlow',
      bold: true,
      fontSize: 7.5,
      alignment: 'justify',
      color: C().ink,
      margin: [0, 0, 0, FOLGA_AVISO]
    };
  }

  /** Quanto o rodapé sobe na última página para caber o aviso. */
  var SUBIDA_AVISO = ALTURA_AVISO + FOLGA_AVISO;

  /** Rodapé: o mesmo fio do cabeçalho, contatos da empresa e numeração. */
  function rodape(pagina, total) {
    var b = GIRO.brand;
    var ultima = pagina === total;
    return {
      margin: [MARGENS[0], 12 - (ultima ? SUBIDA_AVISO : 0), MARGENS[2], 0],
      stack: [
        Object.assign(filete(0), { margin: [0, 0, 0, 5] })
      ].concat(ultima ? [aviso()] : [], [
        {
          columns: [
            {
              // A numeração fica com a largura que precisa e os contatos com o
              // resto: com dois telefones, meia linha não bastava.
              width: '*',
              text: ['CNPJ ' + b.cnpj].concat(b.telefones, 'Documento confidencial')
                .join('  ·  '),
              font: 'Carlito',
              fontSize: 7.5,
              color: C().inkSoft
            },
            {
              width: 'auto',
              text: 'Página ' + pagina + ' de ' + total,
              font: 'Carlito',
              fontSize: 8,
              color: C().inkSoft,
              alignment: 'right',
              margin: [8, 0, 0, 0]
            }
          ]
        }
      ])
    };
  }

  // ---- coleta de imagens ---------------------------------------------------
  function idsDeImagem(laudo) {
    var ids = [];
    if (laudo.condutor.fotoId) { ids.push(laudo.condutor.fotoId); }
    if (laudo.associado.fotoId) { ids.push(laudo.associado.fotoId); }
    ids = ids.concat(laudo.fotos, laudo.parecer.fotos);
    laudo.terceiros.forEach(function (t) {
      if (t.dados.fotoId) { ids.push(t.dados.fotoId); }
      ids = ids.concat(t.fotos);
    });
    return ids;
  }

  function carregarImagens(laudo) {
    var ids = idsDeImagem(laudo);
    return Promise.all(ids.map(function (id) {
      return GIRO.photos.paraDataUrl(id);
    })).then(function (urls) {
      var mapa = {};
      ids.forEach(function (id, i) { if (urls[i]) { mapa[id] = urls[i]; } });
      return mapa;
    });
  }

  var MARCA_DAGUA_FORCA = 0.1;

  /**
   * Versão da arte para a marca d'água: cada cor vira o cinza da sua
   * luminância e desmaia sobre o branco do papel.
   *
   * O desmaio é feito na cor, e não com opacidade, por dois motivos: o
   * `background` do pdfmake é desenhado antes do conteúdo, sobre a folha
   * branca, então o resultado é o mesmo; e o nó `svg` do pdfmake ignora
   * `opacity` — só o nó `image` a respeita.
   */
  function marcaDagua(svg) {
    return svg.replace(/#([0-9a-fA-F]{6})\b/g, function (_, hex) {
      var r = parseInt(hex.slice(0, 2), 16);
      var g = parseInt(hex.slice(2, 4), 16);
      var b = parseInt(hex.slice(4, 6), 16);
      // Luminância perceptual: o laranja da marca cai num cinza médio, e não
      // no quase branco que a média simples dos canais produziria.
      var lum = r * 0.299 + g * 0.587 + b * 0.114;
      var v = Math.round(255 - (255 - lum) * MARCA_DAGUA_FORCA);
      var h = (v < 16 ? '0' : '') + v.toString(16);
      return '#' + h + h + h;
    });
  }

  /** Proporção da arte, lida do próprio desenho. */
  function proporcaoDoSvg(svg) {
    var m = /viewBox\s*=\s*"\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)/.exec(svg);
    if (!m) { return PROPORCAO_LOGO; }
    var largura = parseFloat(m[1]);
    var altura = parseFloat(m[2]);
    return largura > 0 ? altura / largura : PROPORCAO_LOGO;
  }

  /**
   * Logotipo em duas versões: a de cor, para os cabeçalhos, e a apagada, para
   * a marca d'água. A apagada sai da mesma arte em vez de ser um segundo
   * arquivo, para trocar o logotipo continuar mudando tudo de uma vez.
   *
   * A arte é vetorial e vai para o PDF como vetor: a capa fica nítida em
   * qualquer tamanho, e não há mapa de bits nem canvas no caminho — era o
   * ida-e-volta por `getImageData` que estragava as bordas semitransparentes
   * do PNG quando o logotipo era ampliado.
   */
  function carregarLogo() {
    if (!GIRO.brand.logo) { return Promise.resolve(null); }

    return fetch(GIRO.brand.logo)
      .then(function (r) { return r.ok ? r.text() : null; })
      .then(function (svg) {
        if (!svg || svg.indexOf('<svg') < 0) { return null; }
        return {
          cor: svg,
          cinza: marcaDagua(svg),
          proporcao: proporcaoDoSvg(svg)
        };
      })
      .catch(function () { return null; });   // laudo sem logotipo é melhor que laudo nenhum
  }

  // ---- documento -----------------------------------------------------------
  function montarConteudo(laudo, mapa) {
    var conteudo = [];

    // Um bloco quando o associado é o próprio condutor, dois quando são
    // pessoas diferentes. A faixa da capa desce para não encostar no cabeçalho.
    if (laudo.associadoEhCondutor) {
      conteudo.push(faixa('DADOS DO ASSOCIADO / CONDUTOR', { margin: [0, RECUO_CAPA, 0, 8] }));
      conteudo.push(blocoPessoa(laudo.condutor, mapa[laudo.condutor.fotoId]));
    } else {
      conteudo.push(faixa('DADOS DO CONDUTOR', { margin: [0, RECUO_CAPA, 0, 8] }));
      conteudo.push(blocoPessoa(laudo.condutor, mapa[laudo.condutor.fotoId]));

      conteudo.push(faixa('DADOS DO ASSOCIADO'));
      conteudo.push(blocoPessoa(laudo.associado, mapa[laudo.associado.fotoId]));
    }

    conteudo.push(faixa('DADOS DO VEÍCULO DO ASSOCIADO'));
    conteudo.push(blocoVeiculo(laudo.veiculo));

    conteudo.push(faixa('RELATO CONFORME BOLETIM DE OCORRÊNCIA', { pageBreak: 'before' }));
    conteudo.push(blocoRelato(
      laudo.bo.numero ? 'Nº ' + laudo.bo.numero : '',
      laudo.bo.relato,
      'EMITIDO EM: ' + dataHoraBr(laudo.bo.emitidoEm)
    ));

    var varios = laudo.terceiros.length > 1;
    laudo.terceiros.forEach(function (t, i) {
      var sufixo = varios ? ' ' + (i + 1) : '';

      conteudo.push(faixa('DADOS DO TERCEIRO' + sufixo, { pageBreak: 'before' }));
      conteudo.push(blocoPessoa(t.dados, mapa[t.dados.fotoId]));

      conteudo.push(faixa('DADOS DO VEÍCULO DO TERCEIRO' + sufixo));
      conteudo.push(blocoVeiculo(t.veiculo));

      conteudo.push(faixa('RELATO CONFORME TERCEIRO' + sufixo, { pageBreak: 'before' }));
      conteudo.push(blocoRelato('', t.relato.texto, t.relato.origem));
    });

    var tituloFotos = 'FOTOS VEÍCULO DO ASSOCIADO';
    if (laudo.veiculo.marca) { tituloFotos += ' - ' + laudo.veiculo.marca.toUpperCase(); }
    blocoFotos(tituloFotos, laudo.fotos, mapa, conteudo);

    laudo.terceiros.forEach(function (t, i) {
      var titulo = 'FOTOS VEÍCULO DO TERCEIRO' + (varios ? ' ' + (i + 1) : '');
      if (t.veiculo.marca) { titulo += ' - ' + t.veiculo.marca.toUpperCase(); }
      blocoFotos(titulo, t.fotos, mapa, conteudo);
    });

    conteudo.push(faixa('PARECER TÉCNICO', { pageBreak: 'before' }));

    // As fotos da descrição do fato entram logo depois do texto que ilustram,
    // em páginas inteiras; o parecer então recomeça em folha limpa.
    var recomecar = false;
    [
      ['DESCRIÇÃO DO FATO', laudo.parecer.descricao, laudo.parecer.fotos],
      ['OBSERVAÇÃO', laudo.parecer.observacao],
      ['CÓDIGO DE TRÂNSITO BRASILEIRO', laudo.parecer.ctb],
      ['CONCLUSÃO', laudo.parecer.conclusao]
    ].forEach(function (secao) {
      var titulo = subfaixa(secao[0]);
      if (recomecar) {
        titulo.pageBreak = 'before';
        recomecar = false;
      }
      conteudo.push(titulo);
      conteudo = conteudo.concat(paragrafos(secao[1]));

      if (secao[2] && secao[2].length) {
        recomecar = blocoFotos('DINÂMICA DO ACIDENTE - CROQUI', secao[2], mapa, conteudo) > 0;
      }
    });

    // Reserva, no fim do conteúdo, o espaço que o rodapé da última página
    // sobe para caber o aviso de confidencialidade. Se não couber, a reserva
    // desce para uma folha nova e o aviso vai junto — nunca por cima do texto.
    conteudo.push({ text: ' ', fontSize: 1, margin: [0, SUBIDA_AVISO + 12, 0, 0] });

    return conteudo;
  }

  function definicao(laudo) {
    return Promise.all([carregarImagens(laudo), carregarLogo()])
      .then(function (r) {
        var mapa = r[0];
        var logo = r[1];

        return {
          pageSize: 'A4',
          pageMargins: MARGENS,
          info: {
            title: GIRO.brand.documento.titulo,
            author: GIRO.brand.nome
          },
          defaultStyle: { font: 'Carlito', fontSize: 10, color: C().ink },
          header: cabecalho(logo),
          footer: rodape,
          background: fundo(logo),
          content: montarConteudo(laudo, mapa)
        };
      });
  }

  function limpar(s) {
    return String(s || '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /** Segue a convenção do laudo de referência: PLACA MARCA - PROPRIETÁRIO.pdf */
  function nomeArquivo(laudo) {
    var partes = [limpar(laudo.veiculo.placa), limpar(laudo.veiculo.marca)]
      .filter(Boolean).join(' ');
    var dono = limpar(laudo.veiculo.proprietario);
    var nome = [partes, dono].filter(Boolean).join(' - ');
    return (nome || 'Laudo de Vistoria') + '.pdf';
  }

  GIRO.pdfdoc = {
    definicao: definicao,
    nomeArquivo: nomeArquivo
  };
})();
