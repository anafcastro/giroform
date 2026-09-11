/*
 * Leitura das consultas que chegam por WhatsApp.
 *
 * As mensagens mudam de estado para estado, mas todas têm a mesma forma: um
 * rótulo e um valor, ou na mesma linha (separados por tabulação) ou em duas
 * linhas seguidas. Por isso o reconhecimento é pelo rótulo, nunca pela
 * posição: a ordem das mensagens não importa e colar uma só também funciona.
 *
 * O que não for reconhecido volta na lista `desconhecidos`, para a tela
 * mostrar. Preferimos deixar um campo vazio e dizer qual rótulo sobrou a
 * arriscar um palpite — corrigir um campo errado custa mais do que preencher
 * um vazio, e quem confere é quem assina o laudo.
 */
window.GIRO = window.GIRO || {};

(function () {
  'use strict';

  /** Normaliza rótulos para comparação: sem acento, sem pontuação, em caixa alta. */
  function chave(s) {
    return String(s || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9]+/g, ' ')
      .trim().toUpperCase();
  }

  /*
   * rótulo -> [bloco, campo, tratamento]
   *
   * bloco '?' é decidido pelo contexto da mensagem; '-' é reconhecido e
   * descartado, porque o laudo não tem onde guardar. Um estado novo com outro
   * rótulo entra aqui como mais uma linha.
   */
  var ROTULOS = {
    // ---- pessoa ----
    'NOME': ['pessoa', 'nome'],
    'MAE': ['pessoa', 'mae'],
    'FILIACAO 1': ['pessoa', 'mae'],
    'RG': ['pessoa', 'rg'],
    'DOCUMENTO': ['pessoa', 'rg', 'documento'],
    'ORGAO EMISSOR UF': ['pessoa', 'rgOrgao'],
    'CPF': ['pessoa', 'cpf', 'cpf'],
    'D N': ['pessoa', 'nascimento', 'data'],
    'DATA NASCIMENTO': ['pessoa', 'nascimento', 'data'],
    'DATA DE NASCIMENTO': ['pessoa', 'nascimento', 'data'],
    'CNH': ['pessoa', 'cnh'],
    'NUMERO REGISTRO': ['pessoa', 'cnh'],
    'VALIDADE': ['pessoa', 'validade', 'data'],
    'VALIDADE CNH': ['pessoa', 'validade', 'data'],
    'RENACH': ['pessoa', 'renach'],
    'OBSERVACAO': ['pessoa', 'observacao'],
    'OBSERVACOES': ['pessoa', 'observacao'],
    'OBSERVACOES CNH': ['pessoa', 'observacao'],

    // ---- veículo ----
    'PROPRIETARIO': ['veiculo', 'proprietario'],
    'CPF CNPJ': ['veiculo', 'cpf', 'cpf'],
    'PLACA': ['veiculo', 'placa', 'placa'],
    'MARCA': ['veiculo', 'marca', 'marca'],
    'MARCA MODELO': ['veiculo', 'marca', 'marca'],
    'FURTO': ['veiculo', 'furto', 'restricao'],
    'RESTRICAO': ['veiculo', 'furto', 'restricao'],
    'MUNICIPIO DE REGISTRO': ['veiculo', 'municipio'],
    'MUNICIPIO': ['veiculo', 'municipio'],
    'TIPO': ['veiculo', 'tipo'],
    'ESPECIE': ['veiculo', 'especie'],
    'ANO': ['veiculo', 'anoFabModelo'],
    'ANO FABRICACAO MODELO': ['veiculo', 'anoFabModelo'],
    'CHASSI': ['veiculo', 'chassi'],
    'N MOTOR': ['veiculo', 'motor'],
    'NUMERO DO MOTOR': ['veiculo', 'motor'],
    'MOTOR': ['veiculo', 'motor'],
    'COMBUSTIVEL': ['veiculo', 'combustivel'],
    'RENAVAM': ['veiculo', 'renavam'],
    'COR': ['veiculo', 'cor'],
    'COR PREDOMINANTE': ['veiculo', 'cor'],

    // ---- ambíguos: existem nos dois blocos ----
    'CATEGORIA': ['?', 'categoria'],
    'ENDERECO': ['?', 'endereco', 'endereco'],

    // ---- reconhecidos, sem campo no laudo ----
    'FILIACAO 2': ['-'],
    'SEXO': ['-'],
    'NACIONALIDADE': ['-'],
    'SITUACAO CNH': ['-'],
    'UF EMISSAO': ['-'],
    '1 HABILITACAO': ['-'],
    'DATA ULTIMA EMISSAO': ['-'],
    'NUMERO DO LACRE': ['-'],
    'ANO ULTIMO LICENCIAMENTO': ['-']
  };

  /**
   * Quebra o texto colado em [chave, valor, rótulo original].
   * Chave nula é linha que não casou com rótulo nenhum.
   */
  function pares(texto) {
    var linhas = String(texto || '')
      .replace(/\r/g, '')
      // cabeçalho de conversa exportada: "[19:32, 09/09/2026] Fulano:"
      .replace(/^\[[^\]]+\]\s*[^:\n]{1,60}:\s*/gm, '')
      .split('\n');

    var saida = [];
    var pendente = null;

    linhas.forEach(function (linha) {
      var bruta = linha.replace(/\s+$/, '');
      if (!bruta.trim()) { return; }

      // "RÓTULO<tab>valor", "RÓTULO   valor" ou "Rótulo: valor"
      var m = /^(.{2,40}?)(?:\t+| {2,}|:\s)\s*(.*)$/.exec(bruta);
      if (m) {
        if (pendente) { saida.push([pendente, '', pendente]); pendente = null; }
        var k = chave(m[1]);
        saida.push([ROTULOS[k] ? k : null, m[2].trim(), m[1].trim()]);
        return;
      }

      // rótulo sozinho na linha: o valor vem na próxima
      if (!pendente && ROTULOS[chave(bruta)]) { pendente = chave(bruta); return; }

      if (pendente) { saida.push([pendente, bruta.trim(), pendente]); pendente = null; return; }
      saida.push([null, bruta.trim(), null]);
    });

    if (pendente) { saida.push([pendente, '', pendente]); }
    return saida;
  }

  // ---- tratamentos de valor -------------------------------------------------
  function dataIso(v) {
    var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(v).trim());
    return m ? m[3] + '-' + m[2] + '-' + m[1] : v;
  }

  function cpf(v) {
    var d = String(v).replace(/\D/g, '');
    if (d.length !== 11) { return String(v).trim(); }
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  /** O endereço do Detran vem com posições vazias entre vírgulas. */
  function endereco(v) {
    return String(v).split(',').map(function (p) { return p.trim(); })
      .filter(Boolean).join(', ');
  }

  /**
   * Lê o texto colado e devolve o que reconheceu, sem tocar no estado — quem
   * chama decide o que aplicar e o que mostrar.
   */
  function extrair(texto) {
    var pessoa = {};
    var veiculo = {};
    var descartados = [];
    var desconhecidos = [];
    var contexto = 'pessoa';
    var enderecoPessoa = null;
    var rgOrgao = null;

    pares(texto).forEach(function (par) {
      var k = par[0];
      var valor = par[1];

      if (!k) {
        if (valor) { desconhecidos.push(par[2] || valor.slice(0, 30)); }
        return;
      }

      var destino = ROTULOS[k];
      if (destino[0] === '-') {
        if (valor) { descartados.push(par[2] || k); }
        return;
      }
      if (!valor) { return; }

      // Rótulo de um bloco só fixa o contexto; o ambíguo herda o do vizinho.
      var bloco = destino[0];
      if (bloco === 'pessoa' || bloco === 'veiculo') { contexto = bloco; }
      else { bloco = contexto; }

      var campo = destino[1];
      var alvo = bloco === 'pessoa' ? pessoa : veiculo;

      switch (destino[2]) {
        case 'data':
          valor = dataIso(valor);
          break;
        case 'cpf':
          valor = cpf(valor);
          break;
        case 'placa':
          valor = valor.toUpperCase().replace(/[^A-Z0-9]/g, '');
          break;
        case 'documento':
          // "CARTEIRA IDENTIDADE - 1070054" -> só o número
          var mm = /-\s*([A-Z0-9.\/]+)\s*$/i.exec(valor);
          if (mm) { valor = mm[1]; }
          break;
        case 'marca':
          // A cor não vem em campo próprio: fecha a marca, depois de " / ".
          var pedacos = valor.split(/\s+\/\s+/);
          if (pedacos.length > 1) {
            valor = pedacos.slice(0, -1).join(' / ');
            veiculo.cor = pedacos[pedacos.length - 1].trim();
          }
          break;
        case 'restricao':
          // FURTO e RESTRIÇÃO dividem o campo "Furto / restrições".
          if (veiculo.furto && veiculo.furto !== valor) {
            valor = veiculo.furto + ' · ' + valor;
          }
          break;
        case 'endereco':
          valor = endereco(valor);
          // O laudo só tem endereço no veículo. O da pessoa fica de reserva,
          // porque o do veículo é o do registro e vale mais.
          if (bloco === 'pessoa') { enderecoPessoa = valor; return; }
          break;
      }

      if (campo === 'rgOrgao') { rgOrgao = valor.replace(/\s*\/\s*/, '/'); return; }

      // Categoria de CNH tem de uma a três letras; a do veículo é palavra.
      if (campo === 'categoria' && bloco === 'pessoa' && !/^[A-E]{1,3}$/i.test(valor)) {
        alvo = veiculo;
      }

      alvo[campo] = valor;
    });

    if (rgOrgao) { pessoa.rg = [pessoa.rg, rgOrgao].filter(Boolean).join(' '); }
    if (enderecoPessoa && !veiculo.endereco) { veiculo.endereco = enderecoPessoa; }

    return {
      pessoa: pessoa,
      veiculo: veiculo,
      descartados: descartados,
      desconhecidos: desconhecidos
    };
  }

  GIRO.colar = {
    extrair: extrair,
    chave: chave
  };
})();
