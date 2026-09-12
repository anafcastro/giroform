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

  function paragrafos(texto, opcoes) {
    var o = opcoes || {};
    var blocos = String(texto || '').split(/\n{2,}/).filter(function (p) {
      return p.trim().length;
    });
    if (!blocos.length) { return [{ text: '', font: 'Carlito', fontSize: 10 }]; }
    return blocos.map(function (p) {
      return {
        text: p.trim(),
        font: 'Carlito',
        fontSize: o.fontSize || 10.5,
        alignment: o.alignment || 'justify',
        lineHeight: 1.15,
        margin: [0, 0, 0, 6]
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
  var LOGO_LARGURA = 66;

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
  function cabecalho(temLogo) {
    return function () {
      var b = GIRO.brand;

      // Referência ao dicionário `images` do documento: o cabeçalho é
      // reconstruído a cada página e, sem o nome, o pdfmake embutiria uma
      // cópia do PNG por página.
      var marca = temLogo
        ? { width: LOGO_LARGURA, stack: [{ image: 'logo', width: LOGO_LARGURA }] }
        : {
            width: 'auto',
            text: b.nome,
            font: 'Barlow',
            bold: true,
            fontSize: 11.5,
            characterSpacing: 0.4,
            color: C().ink,
            margin: [0, 9, 0, 0]
          };

      return {
        margin: [MARGENS[0], 30, MARGENS[2], 0],
        stack: [
          {
            columnGap: 14,
            columns: [
              marca,
              {
                width: '*',
                margin: [0, 3, 0, 0],
                stack: [
                  {
                    text: b.documento.titulo,
                    font: 'BarlowCondensed',
                    bold: true,
                    fontSize: 13,
                    characterSpacing: 1.1,
                    color: C().ink,
                    alignment: 'right'
                  },
                  {
                    text: b.documento.subtitulo,
                    font: 'Carlito',
                    fontSize: 7.5,
                    color: C().inkSoft,
                    alignment: 'right',
                    margin: [0, 1, 0, 0]
                  }
                ]
              }
            ]
          },
          filete(11)
        ]
      };
    };
  }

  var MARCA_DAGUA_LARGURA = 340;

  /**
   * Marca d'água: o logotipo ao centro da folha, em cinza e a 20%. Vai como
   * `background`, então fica atrás de tudo — inclusive das faixas de título —
   * e se repete em todas as páginas sem entrar no fluxo do conteúdo.
   */
  function marcaDagua(logo) {
    if (!logo || !logo.cinza) { return undefined; }
    var altura = MARCA_DAGUA_LARGURA * logo.proporcao;
    return function () {
      return {
        image: 'marcaDagua',
        width: MARCA_DAGUA_LARGURA,
        opacity: 0.2,
        absolutePosition: {
          x: (LARGURA_PAGINA - MARCA_DAGUA_LARGURA) / 2,
          y: (ALTURA_PAGINA - altura) / 2
        }
      };
    };
  }

  /** Rodapé: o mesmo fio do cabeçalho, contatos da empresa e numeração. */
  function rodape(pagina, total) {
    var b = GIRO.brand;
    return {
      margin: [MARGENS[0], 12, MARGENS[2], 0],
      stack: [
        Object.assign(filete(0), { margin: [0, 0, 0, 5] }),
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
      ]
    };
  }

  // ---- coleta de imagens ---------------------------------------------------
  function idsDeImagem(laudo) {
    var ids = [];
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

  /** Tons de cinza preservando a transparência do PNG. */
  function emCinza(ctx, largura, altura) {
    try {
      var imagem = ctx.getImageData(0, 0, largura, altura);
      var px = imagem.data;
      for (var i = 0; i < px.length; i += 4) {
        // Luminância perceptual: o laranja da marca cai num cinza médio, e não
        // no quase branco que a média simples dos canais produziria.
        var v = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0;
        px[i] = v;
        px[i + 1] = v;
        px[i + 2] = v;
      }
      ctx.putImageData(imagem, 0, 0);
      return ctx.canvas.toDataURL('image/png');
    } catch (e) {
      return null;   // um laudo sem marca d'água é melhor do que nenhum laudo
    }
  }

  /**
   * Logotipo em duas versões: a de cor, para o cabeçalho, e a cinza, para a
   * marca d'água. A cinza sai da mesma arte em vez de ser um segundo arquivo,
   * para trocar o logotipo continuar mudando tudo de uma vez.
   */
  function carregarLogo() {
    if (!GIRO.brand.logo) { return Promise.resolve(null); }

    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('logotipo não carregou')); };
      img.src = GIRO.brand.logo;
    }).then(function (img) {
      var largura = img.naturalWidth || img.width;
      var altura = img.naturalHeight || img.height;

      var canvas = document.createElement('canvas');
      canvas.width = largura;
      canvas.height = altura;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      // A versão de cor sai antes: emCinza altera o mesmo canvas.
      var cor = canvas.toDataURL('image/png');
      return { cor: cor, cinza: emCinza(ctx, largura, altura), proporcao: altura / largura };
    }).catch(function () { return null; });
  }

  // ---- documento -----------------------------------------------------------
  function montarConteudo(laudo, mapa) {
    var conteudo = [];

    conteudo.push(faixa('DADOS DO ASSOCIADO / CONDUTOR'));
    conteudo.push(blocoPessoa(laudo.associado, mapa[laudo.associado.fotoId]));

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
        recomecar = blocoFotos('FOTOS - ' + secao[0], secao[2], mapa, conteudo) > 0;
      }
    });

    conteudo.push({
      text: GIRO.brand.avisoLgpd,
      font: 'Barlow',
      bold: true,
      fontSize: 7.5,
      alignment: 'justify',
      color: C().ink,
      margin: [24, 26, 24, 0]
    });

    return conteudo;
  }

  function definicao(laudo) {
    return Promise.all([carregarImagens(laudo), carregarLogo()])
      .then(function (r) {
        var mapa = r[0];
        var logo = r[1];
        var imagens = {};
        if (logo) { imagens.logo = logo.cor; }
        if (logo && logo.cinza) { imagens.marcaDagua = logo.cinza; }

        var doc = {
          pageSize: 'A4',
          pageMargins: MARGENS,
          info: {
            title: GIRO.brand.documento.titulo,
            author: GIRO.brand.nome
          },
          defaultStyle: { font: 'Carlito', fontSize: 10, color: C().ink },
          header: cabecalho(!!logo),
          footer: rodape,
          background: marcaDagua(logo),
          content: montarConteudo(laudo, mapa)
        };
        if (Object.keys(imagens).length) { doc.images = imagens; }
        return doc;
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
