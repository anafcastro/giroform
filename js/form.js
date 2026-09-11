/*
 * Formulário: navegação em etapas, ligação bidirecional com o estado,
 * terceiros dinâmicos e galerias de fotos.
 *
 * A ligação é por `data-path`: cada campo declara onde mora no estado
 * ("associado.nome", "terceiros.0.veiculo.placa"), o que dispensa um
 * mapeamento manual campo a campo.
 */
window.GIRO = window.GIRO || {};

(function () {
  'use strict';

  var S = function () { return GIRO.state; };
  var etapaAtual = 1;
  var totalEtapas = 0;

  function $(sel, raiz) { return (raiz || document).querySelector(sel); }
  function $$(sel, raiz) { return Array.prototype.slice.call((raiz || document).querySelectorAll(sel)); }

  // ---- máscaras ------------------------------------------------------------
  var MASCARAS = {
    cpf: function (v) {
      v = v.replace(/\D/g, '').slice(0, 11);
      return v.replace(/(\d{3})(\d)/, '$1.$2')
              .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
              .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
    },
    placa: function (v) {
      return v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
    },
    chassi: function (v) {
      return v.toUpperCase().replace(/[^A-Z0-9*]/g, '').slice(0, 21);
    },
    telefone: function (v) {
      v = v.replace(/\D/g, '').slice(0, 11);
      if (v.length <= 10) {
        return v.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
      }
      return v.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
    }
  };

  // ---- validação -----------------------------------------------------------

  /** Dígitos verificadores do CPF (módulo 11). */
  function cpfValido(valor) {
    var d = String(valor || '').replace(/\D/g, '');
    if (d.length !== 11) { return false; }
    // 111.111.111-11 e afins satisfazem o cálculo, mas não são CPFs
    if (/^(\d)\1{10}$/.test(d)) { return false; }

    for (var casa = 9; casa < 11; casa++) {
      var soma = 0;
      for (var i = 0; i < casa; i++) {
        soma += parseInt(d.charAt(i), 10) * ((casa + 1) - i);
      }
      var digito = (soma * 10) % 11;
      if (digito === 10) { digito = 0; }
      if (digito !== parseInt(d.charAt(casa), 10)) { return false; }
    }
    return true;
  }

  function mensagemDeErro(el) {
    var fb = el.nextElementSibling;
    if (!fb || !fb.classList.contains('invalid-feedback')) {
      fb = document.createElement('div');
      fb.className = 'invalid-feedback';
      el.insertAdjacentElement('afterend', fb);
    }
    return fb;
  }

  /** Campo vazio não é erro — obrigatoriedade é tratada à parte, na revisão. */
  function conferirCpf(el) {
    var ok = !el.value.trim() || cpfValido(el.value);
    el.classList.toggle('is-invalid', !ok);
    if (!ok) { mensagemDeErro(el).textContent = 'CPF inválido — confira os números.'; }
    return ok;
  }

  function rotuloDe(el) {
    var card = el.closest('.terceiro');
    var prefixo = '';
    if (card) {
      var i = Array.prototype.indexOf.call(card.parentElement.children, card);
      prefixo = 'Terceiro ' + (i + 1) + ' — ';
    }
    var lb = el.id ? document.querySelector('label[for="' + el.id + '"]') : null;
    return prefixo + (lb ? lb.textContent : 'CPF');
  }

  /** CPFs preenchidos que não passam na validação, para avisar antes de emitir. */
  function problemas() {
    return $$('[data-mask="cpf"]').filter(function (el) {
      return el.value.trim() && !cpfValido(el.value);
    }).map(function (el) {
      return rotuloDe(el) + ': ' + el.value;
    });
  }

  // ---- ligação com o estado ------------------------------------------------
  function lerParaTela(raiz) {
    $$('[data-path]', raiz).forEach(function (el) {
      if (!el.matches('input, select, textarea')) { return; }
      var v = S().get(el.dataset.path);
      el.value = (v === undefined || v === null) ? '' : v;
      if (el.tagName === 'TEXTAREA') { autoCrescer(el); }
    });
    lerOpcoes(raiz);
  }

  /**
   * Campos de escolha. Um valor que não esteja entre as opções — vindo de um
   * rascunho antigo ou de uma grafia diferente do Detran — cai em "Outro…"
   * com o texto preservado, em vez de sumir da tela.
   */
  function lerOpcoes(raiz) {
    $$('.campo-opcoes', raiz).forEach(function (caixa) {
      var valor = S().get(caixa.dataset.path) || '';
      var sel = $('select', caixa);
      var livre = $('.campo-outro', caixa);
      var conhecido = Array.prototype.some.call(sel.options, function (o) {
        return o.value === valor;
      });

      if (valor && !conhecido && livre) {
        sel.value = '__outro';
        livre.hidden = false;
        livre.value = valor;
      } else {
        sel.value = conhecido ? valor : '';
        if (livre) { livre.hidden = true; livre.value = ''; }
      }
    });
  }

  function aoEscolher(e) {
    var caixa = e.target.closest('.campo-opcoes');
    if (!caixa) { return; }
    var sel = $('select', caixa);
    var livre = $('.campo-outro', caixa);

    if (e.target === sel) {
      if (sel.value === '__outro' && livre) {
        livre.hidden = false;
        S().set(caixa.dataset.path, livre.value);
        livre.focus();
      } else {
        if (livre) { livre.hidden = true; livre.value = ''; }
        S().set(caixa.dataset.path, sel.value);
      }
    } else if (livre && e.target === livre) {
      S().set(caixa.dataset.path, livre.value);
    } else {
      return;
    }

    GIRO.app.marcarAlteracao();
    atualizarResumos();
  }

  function aoDigitar(e) {
    var el = e.target;
    if (!el.dataset || !el.dataset.path) { return; }

    var mascara = MASCARAS[el.dataset.mask];
    if (mascara) {
      var pos = el.selectionStart;
      var antes = el.value.length;
      el.value = mascara(el.value);
      // mantém o cursor estável quando a máscara insere separadores
      if (document.activeElement === el) {
        var delta = el.value.length - antes;
        try { el.setSelectionRange(pos + delta, pos + delta); } catch (err) { /* ignorado */ }
      }
    }

    S().set(el.dataset.path, el.value);
    if (el.tagName === 'TEXTAREA') { autoCrescer(el); }
    if (el.dataset.mask === 'cpf' && el.classList.contains('is-invalid')) { conferirCpf(el); }
    GIRO.app.marcarAlteracao();
  }

  function autoCrescer(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight + 2, 640) + 'px';
  }

  // ---- etapas --------------------------------------------------------------

  /**
   * Trilha numerada das etapas. É a orientação principal do formulário, então
   * fica sempre visível no topo; no celular rola na horizontal e a etapa atual
   * é trazida para o campo de visão a cada troca.
   */
  function montarEtapas() {
    var lista = $('#etapasLista');
    lista.innerHTML = '';

    $$('.etapa').forEach(function (secao) {
      var n = Number(secao.dataset.etapa);
      var item = document.createElement('li');
      item.className = 'etapa-item';
      item.dataset.ir = String(n);

      var botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'etapa-botao';
      botao.innerHTML =
        '<span class="etapa-num">' + n + '</span>' +
        '<span class="etapa-nome"></span>';
      botao.querySelector('.etapa-nome').textContent = secao.dataset.titulo;
      botao.addEventListener('click', function () { irPara(n); });

      item.appendChild(botao);
      lista.appendChild(item);
    });
  }

  function pintarEtapas() {
    $$('#etapasLista .etapa-item').forEach(function (item) {
      var n = Number(item.dataset.ir);
      item.classList.toggle('atual', n === etapaAtual);
      item.classList.toggle('concluida', n < etapaAtual);
      var botao = $('.etapa-botao', item);
      if (n === etapaAtual) {
        botao.setAttribute('aria-current', 'step');
        botao.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
      } else {
        botao.removeAttribute('aria-current');
      }
    });
  }

  function irPara(n) {
    var secoes = $$('.etapa');
    totalEtapas = secoes.length;
    etapaAtual = Math.max(1, Math.min(n, totalEtapas));

    secoes.forEach(function (secao) {
      secao.hidden = Number(secao.dataset.etapa) !== etapaAtual;
    });

    pintarEtapas();
    // Só a contagem: o nome da etapa já está na pílula acesa da trilha e no
    // título grande da seção, logo abaixo.
    $('#rotuloEtapa').textContent = 'Etapa ' + etapaAtual + ' de ' + totalEtapas;

    $('#btnVoltar').disabled = etapaAtual === 1;
    $('#btnContinuar').hidden = etapaAtual === totalEtapas;
    $('#btnGerar').hidden = etapaAtual !== totalEtapas;

    if (etapaAtual === 5) { renderGalerias(); }
    if (etapaAtual === totalEtapas) { renderRevisao(); }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---- terceiros -----------------------------------------------------------
  /**
   * Recria a lista de cartões. Todos nascem recolhidos — com vários terceiros
   * a etapa viraria uma rolagem interminável; `idAberto` deixa expandido o
   * cartão recém-criado.
   */
  function renderTerceiros(idAberto) {
    var lista = $('#listaTerceiros');
    var tpl = $('#tplTerceiro');
    lista.innerHTML = '';

    S().laudo.terceiros.forEach(function (t, i) {
      var no = tpl.content.firstElementChild.cloneNode(true);
      var base = 'terceiros.' + i + '.';

      no.dataset.terceiroId = t.id;

      // O template é clonado por terceiro; sem sufixo, todos os cartões
      // repetiriam os mesmos ids e o <label> apontaria sempre para o primeiro.
      $$('[id]', no).forEach(function (el) {
        var idNovo = el.id + '-' + i;
        $$('label[for="' + el.id + '"]', no).forEach(function (lb) {
          lb.setAttribute('for', idNovo);
        });
        el.id = idNovo;
      });

      $('.terceiro-titulo', no).textContent = 'Terceiro ' + (i + 1);
      $('.terceiro-resumo', no).textContent = resumoTerceiro(t);

      var idCorpo = 'terceiro-corpo-' + t.id;
      var botao = $('.terceiro-toggle', no);
      var corpo = $('.terceiro-corpo', no);
      var aberto = t.id === idAberto;
      corpo.id = idCorpo;
      corpo.hidden = !aberto;
      botao.setAttribute('aria-controls', idCorpo);
      botao.setAttribute('aria-expanded', String(aberto));

      $$('[data-path]', no).forEach(function (el) {
        el.dataset.path = base + el.dataset.path;
      });
      $$('[data-foto]', no).forEach(function (el) {
        el.dataset.foto = base + el.dataset.foto;
      });

      [
        ['.colar-host-pessoa', 'pessoa', 'dados.', 'no bloco do veículo, logo abaixo'],
        ['.colar-host-veiculo', 'veiculo', 'veiculo.', 'no bloco do condutor, logo acima']
      ].forEach(function (c) {
        var hostColar = $(c[0], no);
        if (!hostColar) { return; }
        hostColar.appendChild(caixaDeColar({
          bloco: c[1],
          base: base + c[2],
          ondeVaiOResto: c[3],
          aoPreencher: function () { lerParaTela(no); atualizarResumos(); }
        }));
      });

      lista.appendChild(no);
      lerParaTela(no);
      renderRetrato($('[data-foto]', no));
    });

    $('#semTerceiros').hidden = S().laudo.terceiros.length > 0;
  }

  function resumoTerceiro(t) {
    var partes = [t.dados.nome, t.veiculo.placa].filter(Boolean);
    return partes.length ? partes.join(' · ') : 'sem dados ainda';
  }

  function atualizarResumos() {
    $$('#listaTerceiros .terceiro').forEach(function (no) {
      var t = S().terceiro(no.dataset.terceiroId);
      if (t) { $('.terceiro-resumo', no).textContent = resumoTerceiro(t); }
    });
  }

  // ---- fotos ---------------------------------------------------------------
  function renderRetrato(container) {
    if (!container) { return; }
    var path = container.dataset.foto;
    var id = S().get(path);
    var alvo = $('.retrato-preview', container);
    alvo.innerHTML = '';

    if (id && GIRO.photos.url(id)) {
      var img = document.createElement('img');
      img.src = GIRO.photos.url(id);
      img.alt = 'Foto anexada';
      alvo.appendChild(img);
      $('.retrato-remover', container).hidden = false;
    } else {
      alvo.innerHTML = '<span class="retrato-vazio">Sem foto</span>';
      $('.retrato-remover', container).hidden = true;
    }
  }

  function renderGalerias() {
    var host = $('#galerias');
    host.innerHTML = '';

    host.appendChild(galeriaCard(
      'Fotos do veículo do associado',
      S().laudo.veiculo.marca || S().laudo.veiculo.placa || '',
      'fotos'
    ));

    S().laudo.terceiros.forEach(function (t, i) {
      host.appendChild(galeriaCard(
        'Fotos do veículo do terceiro ' + (i + 1),
        t.veiculo.marca || t.veiculo.placa || '',
        'terceiros.' + i + '.fotos'
      ));
    });
  }

  /**
   * Botões, grade e contador de uma galeria. É o mesmo bloco na etapa das
   * fotos dos veículos e embutido na descrição do fato — quem chama decide a
   * moldura em volta.
   */
  function galeriaBloco(subtitulo, path) {
    var bloco = document.createElement('div');
    bloco.className = 'galeria';
    bloco.innerHTML =
      '<p class="text-secondary small mb-3 galeria-sub"></p>' +
      '<div class="d-grid gap-2 d-sm-flex mb-3">' +
        '<label class="btn btn-primary btn-lg flex-fill mb-0">Tirar foto' +
          '<input type="file" accept="image/*" capture="environment" multiple hidden>' +
        '</label>' +
        '<label class="btn btn-outline-secondary btn-lg flex-fill mb-0">Escolher da galeria' +
          '<input type="file" accept="image/*" multiple hidden>' +
        '</label>' +
      '</div>' +
      '<div class="foto-grid"></div>' +
      '<p class="foto-contador small text-secondary mt-2 mb-0"></p>';

    $('.galeria-sub', bloco).textContent = subtitulo || 'Uma foto por página no PDF.';

    $$('input[type=file]', bloco).forEach(function (input) {
      input.addEventListener('change', function () {
        receberFotos(input.files, path, bloco);
        input.value = '';
      });
    });

    desenharGrade(bloco, path);
    return bloco;
  }

  function galeriaCard(titulo, subtitulo, path) {
    var card = document.createElement('section');
    card.className = 'card card-etapa mb-3';
    card.innerHTML = '<div class="card-body"><h3 class="h6 mb-1"></h3></div>';

    $('h3', card).textContent = titulo;
    $('.card-body', card).appendChild(galeriaBloco(subtitulo, path));
    return card;
  }

  /**
   * Galeria da descrição do fato (etapa 6). Não depende de terceiros nem de
   * nada que mude durante o preenchimento, então é montada uma única vez.
   */
  function renderGaleriaParecer() {
    var host = $('#galeriaParecer');
    if (!host) { return; }
    host.innerHTML = '';
    host.appendChild(galeriaBloco(
      'Cada foto entra em uma página inteira do PDF, logo após o texto acima.',
      'parecer.fotos'
    ));
  }

  function desenharGrade(bloco, path) {
    var grade = $('.foto-grid', bloco);
    var ids = S().get(path) || [];
    grade.innerHTML = '';

    ids.forEach(function (id, i) {
      var item = document.createElement('figure');
      item.className = 'foto-item';
      item.draggable = true;
      item.dataset.indice = String(i);

      var img = document.createElement('img');
      img.src = GIRO.photos.url(id) || '';
      img.alt = 'Foto ' + (i + 1);
      item.appendChild(img);

      var acoes = document.createElement('div');
      acoes.className = 'foto-acoes';
      acoes.innerHTML =
        '<button type="button" class="btn btn-sm btn-light" data-mover="-1" aria-label="Mover para trás">&#8592;</button>' +
        '<button type="button" class="btn btn-sm btn-light" data-mover="1" aria-label="Mover para frente">&#8594;</button>' +
        '<button type="button" class="btn btn-sm btn-light text-danger" data-remover aria-label="Remover foto">&times;</button>';
      item.appendChild(acoes);

      acoes.addEventListener('click', function (e) {
        var btn = e.target.closest('button');
        if (!btn) { return; }
        if (btn.hasAttribute('data-remover')) {
          removerFoto(path, i, bloco);
        } else {
          moverFoto(path, i, i + Number(btn.dataset.mover), bloco);
        }
      });

      item.addEventListener('dragstart', function (e) {
        e.dataTransfer.setData('text/plain', String(i));
        item.classList.add('arrastando');
      });
      item.addEventListener('dragend', function () { item.classList.remove('arrastando'); });
      item.addEventListener('dragover', function (e) { e.preventDefault(); });
      item.addEventListener('drop', function (e) {
        e.preventDefault();
        var de = Number(e.dataTransfer.getData('text/plain'));
        moverFoto(path, de, i, bloco);
      });

      grade.appendChild(item);
    });

    $('.foto-contador', bloco).textContent = ids.length
      ? ids.length + (ids.length === 1 ? ' foto — 1 página no PDF' : ' fotos — ' + ids.length + ' páginas no PDF')
      : 'Nenhuma foto anexada.';
  }

  function receberFotos(files, path, bloco) {
    var lista = Array.prototype.slice.call(files || []);
    if (!lista.length) { return; }

    var contador = $('.foto-contador', bloco);
    var feitas = 0;
    contador.textContent = 'Processando 0 de ' + lista.length + '…';

    var fila = lista.reduce(function (p, file) {
      return p.then(function () {
        return GIRO.photos.adicionar(file, 'veiculo').then(function (id) {
          S().get(path).push(id);
          feitas += 1;
          contador.textContent = 'Processando ' + feitas + ' de ' + lista.length + '…';
        });
      });
    }, Promise.resolve());

    fila.then(function () {
      desenharGrade(bloco, path);
      GIRO.app.marcarAlteracao();
    }).catch(function (err) {
      contador.textContent = 'Não foi possível ler alguma das imagens.';
      console.error(err);
    });
  }

  function removerFoto(path, indice, bloco) {
    var ids = S().get(path);
    var removido = ids.splice(indice, 1)[0];
    GIRO.photos.esquecer([removido]);
    desenharGrade(bloco, path);
    GIRO.app.marcarAlteracao();
  }

  function moverFoto(path, de, para, bloco) {
    var ids = S().get(path);
    if (para < 0 || para >= ids.length || de === para) { return; }
    ids.splice(para, 0, ids.splice(de, 1)[0]);
    desenharGrade(bloco, path);
    GIRO.app.marcarAlteracao();
  }

  // ---- colar mensagens -----------------------------------------------------

  /**
   * Valor de campo de escolha na grafia do formulário. O Detran manda
   * "AUTOMOVEL"; a opção do select é "Automóvel". Sem isto o valor cairia em
   * "Outro…" e sairia sem acento no laudo. A lista sai do próprio select, que
   * é a única fonte das opções.
   */
  function canonizar(path, valor) {
    var caixa = $('.campo-opcoes[data-path="' + path + '"]');
    var sel = caixa && $('select', caixa);
    if (!sel) { return valor; }
    var opcao = Array.prototype.find.call(sel.options, function (o) {
      return o.value && GIRO.colar.chave(o.value) === GIRO.colar.chave(valor);
    });
    return opcao ? opcao.value : valor;
  }

  /** Campos que o texto colado mudaria, para avisar antes de sobrescrever. */
  function conflitos(base, valores) {
    return Object.keys(valores).filter(function (campo) {
      var atual = S().get(base + campo);
      return atual && atual !== valores[campo];
    }).length;
  }

  function aplicarBloco(base, valores) {
    var n = 0;
    Object.keys(valores).forEach(function (campo) {
      var path = base + campo;
      // Campo que não existe no modelo é descartado em silêncio: o parser
      // pode conhecer um rótulo que o laudo ainda não tem onde guardar.
      if (S().get(path) === undefined) { return; }
      if (!String(valores[campo] || '').trim()) { return; }
      S().set(path, canonizar(path, valores[campo]));
      n += 1;
    });
    return n;
  }

  function frase(n, um, varios) {
    return n + ' ' + (n === 1 ? um : varios);
  }

  var ROTULO_BLOCO = {
    pessoa: { nome: 'do condutor', outro: 'veiculo' },
    veiculo: { nome: 'do veículo', outro: 'pessoa' }
  };

  /**
   * Caixa de colar. Cada uma cuida de uma metade só: a do condutor fica na
   * etapa dele e a do veículo na etapa do veículo, para a usuária não ter que
   * decidir onde colar o quê.
   *
   * `opcoes`: bloco ('pessoa' ou 'veiculo'), base (prefixo de caminho do
   * destino), ondeVaiOResto (texto que aponta a outra caixa) e aoPreencher.
   */
  function caixaDeColar(opcoes) {
    var meu = opcoes.bloco;
    var outro = ROTULO_BLOCO[meu].outro;

    var bloco = document.createElement('div');
    bloco.className = 'colar';
    bloco.innerHTML =
      '<p class="text-secondary small mb-2 colar-sub"></p>' +
      '<textarea class="form-control colar-texto" rows="4" autocomplete="off" spellcheck="false" ' +
      'aria-label="Mensagem recebida"></textarea>' +
      '<button type="button" class="btn btn-primary mt-2 colar-aplicar">Preencher campos</button>' +
      '<p class="colar-aviso small mt-2 mb-0" hidden></p>';

    $('.colar-sub', bloco).textContent =
      'Os dados ' + ROTULO_BLOCO[meu].nome + ' são preenchidos abaixo e ficam editáveis.';

    var texto = $('.colar-texto', bloco);
    var aviso = $('.colar-aviso', bloco);

    function relatar(classe, partes) {
      aviso.className = 'colar-aviso small mt-2 mb-0 ' + classe;
      aviso.innerHTML = partes.join('<br>');
      aviso.hidden = false;
    }

    $('.colar-aplicar', bloco).addEventListener('click', function () {
      if (!texto.value.trim()) {
        relatar('text-secondary', ['Cole o texto da mensagem antes de preencher.']);
        return;
      }

      var lido = GIRO.colar.extrair(texto.value);
      var meus = lido[meu];
      var sobra = Object.keys(lido[outro]).length;

      if (!Object.keys(meus).length) {
        relatar('text-danger', [sobra
          ? 'Esta mensagem é ' + ROTULO_BLOCO[outro].nome + ', não ' + ROTULO_BLOCO[meu].nome +
            '. Cole ela ' + opcoes.ondeVaiOResto + '.'
          : 'Nenhum campo reconhecido neste texto. Confira se a mensagem foi copiada inteira.']);
        return;
      }

      var mudanca = conflitos(opcoes.base, meus);
      if (mudanca && !window.confirm(
        frase(mudanca, 'campo já preenchido será substituído', 'campos já preenchidos serão substituídos') +
        '. Continuar?')) { return; }

      var partes = [frase(aplicarBloco(opcoes.base, meus), 'campo preenchido.', 'campos preenchidos.')];
      if (lido.descartados.length) {
        partes.push(frase(lido.descartados.length, 'informação sem campo no laudo:', 'informações sem campo no laudo:') +
          ' ' + escapar(lido.descartados.join(', ')) + '.');
      }
      if (lido.desconhecidos.length) {
        partes.push('<strong>Não reconhecido, preencha à mão:</strong> ' +
          escapar(lido.desconhecidos.join(', ')) + '.');
      }
      // O texto só sai da caixa quando não sobrou nada dele para a outra:
      // assim ela copia daqui em vez de voltar ao WhatsApp.
      if (sobra) {
        partes.push('<strong>' + frase(sobra, 'campo ' + ROTULO_BLOCO[outro].nome + ' ficou de fora',
          'campos ' + ROTULO_BLOCO[outro].nome + ' ficaram de fora') +
          '.</strong> Cole este mesmo texto ' + opcoes.ondeVaiOResto + '.');
      } else {
        texto.value = '';
      }

      relatar(lido.desconhecidos.length ? 'text-danger' : (sobra ? 'text-secondary' : 'text-success'), partes);
      GIRO.app.marcarAlteracao();
      opcoes.aoPreencher();
    });

    return bloco;
  }

  /** As duas caixas fixas do laudo: o condutor na etapa 1, o veículo na 2. */
  function renderColarAssociado() {
    [
      ['#colarAssociado', 'pessoa', 'associado.', 'na etapa 2, em "Veículo do associado"'],
      ['#colarVeiculo', 'veiculo', 'veiculo.', 'na etapa 1, em "Associado / condutor"']
    ].forEach(function (c) {
      var host = $(c[0]);
      if (!host) { return; }
      host.innerHTML = '';
      host.appendChild(caixaDeColar({
        bloco: c[1],
        base: c[2],
        ondeVaiOResto: c[3],
        aoPreencher: function () { lerParaTela(document); }
      }));
    });
  }

  // ---- revisão -------------------------------------------------------------
  var OBRIGATORIOS = [
    ['associado.nome', 'Nome do associado'],
    ['veiculo.placa', 'Placa do veículo do associado'],
    ['veiculo.marca', 'Marca/modelo do veículo do associado'],
    ['veiculo.proprietario', 'Proprietário do veículo do associado'],
    ['parecer.conclusao', 'Conclusão do parecer técnico']
  ];

  function pendencias() {
    return OBRIGATORIOS.filter(function (c) {
      return !String(S().get(c[0]) || '').trim();
    }).map(function (c) { return c[1]; });
  }

  function renderRevisao() {
    var l = S().laudo;
    var itens = [
      ['Associado', l.associado.nome || '—'],
      ['Veículo', [l.veiculo.marca, l.veiculo.placa].filter(Boolean).join(' · ') || '—'],
      ['Boletim de ocorrência', l.bo.numero ? 'Nº ' + l.bo.numero : '—'],
      ['Terceiros', String(l.terceiros.length)],
      ['Fotos de veículo', String(l.fotos.length + l.terceiros.reduce(function (n, t) { return n + t.fotos.length; }, 0))]
    ];
    if (l.parecer.fotos.length) {
      itens.push(['Fotos da descrição do fato', String(l.parecer.fotos.length)]);
    }
    itens.push(['Arquivo', GIRO.pdfdoc.nomeArquivo(l)]);

    $('#resumoRevisao').innerHTML = itens.map(function (i) {
      return '<div class="resumo-linha"><dt>' + i[0] + '</dt><dd>' + escapar(i[1]) + '</dd></div>';
    }).join('');

    var aviso = $('#pendencias');
    var partes = '';
    var faltas = pendencias();
    var invalidos = problemas();
    if (faltas.length) {
      partes += '<strong>Faltam preencher:</strong><ul class="mb-0 mt-1"><li>' +
        faltas.map(escapar).join('</li><li>') + '</li></ul>';
    }
    if (invalidos.length) {
      partes += '<strong class="d-block mt-2">CPF inválido:</strong><ul class="mb-0 mt-1"><li>' +
        invalidos.map(escapar).join('</li><li>') + '</li></ul>';
    }
    aviso.hidden = !partes;
    if (partes) { aviso.innerHTML = partes; }
  }

  function escapar(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // ---- inicialização -------------------------------------------------------
  function init() {
    document.addEventListener('input', function (e) {
      aoDigitar(e);
      aoEscolher(e);
    });
    document.addEventListener('change', function (e) {
      if (e.target.dataset && e.target.dataset.path) {
        aoDigitar(e);
        atualizarResumos();
      }
      aoEscolher(e);
    });
    document.addEventListener('focusout', function (e) {
      if (e.target.dataset && e.target.dataset.mask === 'cpf') { conferirCpf(e.target); }
    });

    $('#btnVoltar').addEventListener('click', function () { irPara(etapaAtual - 1); });
    $('#btnContinuar').addEventListener('click', function () { irPara(etapaAtual + 1); });

    $('#btnAddTerceiro').addEventListener('click', function () {
      var novo = S().novoTerceiro();
      renderTerceiros(novo.id);
      GIRO.app.marcarAlteracao();
      var cards = $$('#listaTerceiros .terceiro');
      if (cards.length) { cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    });

    // Delegação para os controles dos cartões de terceiro (recriados a cada render).
    $('#listaTerceiros').addEventListener('click', function (e) {
      var card = e.target.closest('.terceiro');
      if (!card) { return; }

      if (e.target.closest('.terceiro-remover')) {
        if (!window.confirm('Remover este terceiro e as fotos dele?')) { return; }
        var orfas = S().removerTerceiro(card.dataset.terceiroId);
        GIRO.photos.esquecer(orfas);
        renderTerceiros();
        GIRO.app.marcarAlteracao();
        return;
      }

      var toggle = e.target.closest('.terceiro-toggle');
      if (toggle) {
        var corpo = $('.terceiro-corpo', card);
        var aberto = !corpo.hidden;
        corpo.hidden = aberto;
        toggle.setAttribute('aria-expanded', String(!aberto));
      }
    });

    // Retratos (associado e terceiros) — um input só, com preview.
    document.addEventListener('change', function (e) {
      var container = e.target.closest('[data-foto]');
      if (!container || e.target.type !== 'file') { return; }
      var file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) { return; }

      var path = container.dataset.foto;
      var anterior = S().get(path);
      GIRO.photos.adicionar(file, 'retrato').then(function (id) {
        if (anterior) { GIRO.photos.esquecer([anterior]); }
        S().set(path, id);
        renderRetrato(container);
        GIRO.app.marcarAlteracao();
      });
    });

    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.retrato-remover');
      if (!btn) { return; }
      var container = btn.closest('[data-foto]');
      var path = container.dataset.foto;
      var id = S().get(path);
      if (id) { GIRO.photos.esquecer([id]); }
      S().set(path, null);
      renderRetrato(container);
      GIRO.app.marcarAlteracao();
    });

    montarEtapas();
    lerParaTela(document);
    renderColarAssociado();
    renderGaleriaParecer();
    renderTerceiros();
    $$('[data-foto]').forEach(renderRetrato);
    irPara(1);
  }

  GIRO.form = {
    init: init,
    irPara: irPara,
    pendencias: pendencias,
    problemas: problemas,
    cpfValido: cpfValido
  };
})();
