/*
 * Orquestração: retomada de rascunho, janela de expiração, modal de
 * confirmação, geração do PDF e limpeza.
 */
window.GIRO = window.GIRO || {};

(function () {
  'use strict';

  function $(sel) { return document.querySelector(sel); }

  function escapar(t) {
    return String(t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function bloco(titulo, itens) {
    if (!itens.length) { return ''; }
    return '<strong>' + titulo + '</strong><ul class="mb-0 mt-1"><li>' +
      itens.map(escapar).join('</li><li>') + '</li></ul>';
  }

  /** Monta o aviso do modal, ou '' quando não há nada a apontar. */
  function listaDeAvisos(faltas, invalidos) {
    var partes = bloco('Campos obrigatórios em branco:', faltas) +
                 bloco('CPF inválido:', invalidos);
    if (!partes) { return ''; }
    return partes +
      '<p class="mb-0 mt-2">Dá para gerar assim mesmo, mas confira antes de entregar o laudo.</p>';
  }

  var sujo = false;
  var concluido = false;
  var avisoExpiracaoVisivel = false;

  function marcarAlteracao() {
    sujo = true;
    GIRO.storage.salvar(GIRO.state.laudo);
    esconderAvisoExpiracao();
  }

  // ---- janela de 1 hora ----------------------------------------------------
  function vigiarExpiracao() {
    setInterval(function () {
      if (concluido) { return; }
      if (GIRO.storage.expirou()) {
        expirar();
      } else if (GIRO.storage.perto()) {
        mostrarAvisoExpiracao();
      }
    }, 30000);
  }

  function mostrarAvisoExpiracao() {
    if (avisoExpiracaoVisivel) { return; }
    avisoExpiracaoVisivel = true;
    var faixa = $('#avisoExpiracao');
    var min = Math.max(1, Math.round(GIRO.storage.restaMs() / 60000));
    $('#avisoExpiracaoTexto').textContent =
      'Por segurança, este rascunho será apagado deste aparelho em cerca de ' + min +
      ' min sem alterações.';
    faixa.hidden = false;
  }

  function esconderAvisoExpiracao() {
    if (!avisoExpiracaoVisivel) { return; }
    avisoExpiracaoVisivel = false;
    $('#avisoExpiracao').hidden = true;
  }

  function expirar() {
    concluido = true; // desarma o beforeunload
    limparTudo().then(function () {
      window.alert('O rascunho foi apagado deste aparelho por inatividade (1 hora).');
      window.location.reload();
    });
  }

  function limparTudo() {
    GIRO.photos.limparTudo();
    GIRO.state.reset();
    sujo = false;
    return GIRO.storage.wipeAll();
  }

  // ---- retomada ------------------------------------------------------------
  function retomarRascunho() {
    if (GIRO.storage.expirou()) {
      return GIRO.storage.wipeAll().then(function () { return false; });
    }

    var m = GIRO.storage.carregar();
    if (!m) {
      // Sem rascunho válido, qualquer foto no IndexedDB é órfã de uma sessão anterior.
      return GIRO.storage.wipeAll().then(function () { return false; });
    }

    return GIRO.photos.reidratar().then(function () {
      if (!GIRO.state.hydrate(m.laudo)) {
        // rascunho de versão antiga: descartar é melhor que quebrar a tela
        GIRO.photos.limparTudo();
        return GIRO.storage.wipeAll().then(function () { return false; });
      }
      var quando = new Date(m.updatedAt).toLocaleTimeString('pt-BR', {
        hour: '2-digit', minute: '2-digit'
      });
      $('#avisoRascunhoTexto').textContent =
        'Rascunho recuperado deste aparelho (última alteração às ' + quando + ').';
      $('#avisoRascunho').hidden = false;
      return true;
    });
  }

  // ---- PDF -----------------------------------------------------------------
  function construirPdf() {
    return GIRO.fonts.carregar().then(function () {
      return GIRO.pdfdoc.definicao(GIRO.state.laudo);
    }).then(function (def) {
      return pdfMake.createPdf(def);
    });
  }

  function ocupado(botao, texto) {
    botao.disabled = true;
    botao.dataset.rotulo = botao.textContent;
    botao.textContent = texto;
  }

  function livre(botao) {
    botao.disabled = false;
    if (botao.dataset.rotulo) { botao.textContent = botao.dataset.rotulo; }
  }

  function preVisualizar() {
    var btn = $('#btnPreview');
    ocupado(btn, 'Gerando prévia…');

    construirPdf().then(function (pdf) {
      pdf.getDataUrl(function (url) {
        $('#framePreview').src = url;
        bootstrap.Modal.getOrCreateInstance($('#modalPreview')).show();
        livre(btn);
      });
    }).catch(function (err) {
      livre(btn);
      console.error(err);
      window.alert('Não foi possível gerar a prévia: ' + err.message);
    });
  }

  function abrirConfirmacao() {
    var l = GIRO.state.laudo;
    var fotos = l.fotos.length + l.terceiros.reduce(function (n, t) { return n + t.fotos.length; }, 0);

    $('#confTerceiros').textContent = String(l.terceiros.length);
    $('#confFotos').textContent = String(fotos);
    $('#confArquivo').textContent = GIRO.pdfdoc.nomeArquivo(l);

    var box = $('#confPendencias');
    var avisos = listaDeAvisos(GIRO.form.pendencias(), GIRO.form.problemas());
    box.hidden = !avisos;
    if (avisos) { box.innerHTML = avisos; }

    bootstrap.Modal.getOrCreateInstance($('#modalConfirmar')).show();
  }

  function gerar() {
    var btn = $('#btnConfirmarGerar');
    ocupado(btn, 'Gerando…');

    construirPdf().then(function (pdf) {
      var nome = GIRO.pdfdoc.nomeArquivo(GIRO.state.laudo);
      pdf.getBlob(function (blob) {
        baixar(blob, nome);
        concluir(nome);
        livre(btn);
        bootstrap.Modal.getOrCreateInstance($('#modalConfirmar')).hide();
      });
    }).catch(function (err) {
      livre(btn);
      console.error(err);
      window.alert('Não foi possível gerar o PDF: ' + err.message);
    });
  }

  function baixar(blob, nome) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = nome;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    // dá tempo do navegador iniciar o download antes de soltar o blob
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }

  /** Gerado o PDF, o aparelho não guarda mais nada deste laudo. */
  function concluir(nome) {
    concluido = true;
    limparTudo().then(function () {
      $('#nomeArquivoGerado').textContent = nome;
      $('#appPrincipal').hidden = true;
      $('#barraNavegacao').hidden = true;
      $('#telaConcluido').hidden = false;
      window.scrollTo({ top: 0 });
    });
  }

  // ---- boot ----------------------------------------------------------------
  function init() {
    var b = GIRO.brand;
    document.getElementById('cabecalhoTitulo').textContent = b.documento.titulo;
    document.getElementById('cabecalhoSub').textContent = b.documento.subtitulo;
    var logo = document.getElementById('cabecalhoLogo');
    if (b.logo) {
      logo.src = b.logo;
      logo.alt = b.nome;
    } else {
      logo.replaceWith(Object.assign(document.createElement('span'), {
        className: 'cabecalho-nome',
        textContent: b.nome
      }));
    }
    document.title = b.documento.titulo + ' · ' + b.nome;

    retomarRascunho().then(function () {
      GIRO.form.init();
      vigiarExpiracao();
    });

    $('#btnDescartarRascunho').addEventListener('click', function () {
      if (!window.confirm('Apagar o rascunho deste aparelho? Os dados preenchidos serão perdidos.')) { return; }
      concluido = true;
      limparTudo().then(function () { window.location.reload(); });
    });

    $('#btnNovoLaudo').addEventListener('click', function () {
      if (sujo && !window.confirm('Começar um laudo novo? Os dados atuais serão apagados.')) { return; }
      concluido = true;
      limparTudo().then(function () { window.location.reload(); });
    });

    $('#btnApagarRascunho').addEventListener('click', function () {
      if (!window.confirm('Apagar tudo o que está salvo neste aparelho?')) { return; }
      concluido = true;
      limparTudo().then(function () { window.location.reload(); });
    });

    $('#btnContinuarPreenchendo').addEventListener('click', function () {
      GIRO.storage.tocar();
      esconderAvisoExpiracao();
    });

    $('#btnPreview').addEventListener('click', preVisualizar);
    $('#btnGerar').addEventListener('click', abrirConfirmacao);
    $('#btnConfirmarGerar').addEventListener('click', gerar);
    $('#btnComecarNovo').addEventListener('click', function () { window.location.reload(); });

    $('#modalPreview').addEventListener('hidden.bs.modal', function () {
      $('#framePreview').src = 'about:blank';
    });

    window.addEventListener('beforeunload', function (e) {
      if (!sujo || concluido) { return; }
      e.preventDefault();
      e.returnValue = '';
    });
  }

  GIRO.app = {
    init: init,
    marcarAlteracao: marcarAlteracao
  };

  document.addEventListener('DOMContentLoaded', init);
})();
