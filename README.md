# Laudo de Vistoria — formulário web com geração de PDF

Página estática que substitui o preenchimento manual do `MODELO 1.docx` no Word.
A pessoa preenche o formulário — desenhado para uso no celular, em campo — e baixa
o laudo em PDF já diagramado.

**Nenhum dado sai do aparelho.** Não há servidor, back-end, analytics ou qualquer
requisição que carregue conteúdo do formulário. O PDF é montado no próprio navegador.

## Como usar

Abra a página, preencha as 7 etapas e, na última, clique em **Gerar PDF**. Um modal
mostra o que será emitido e pede confirmação; só depois o arquivo é baixado.

A trilha numerada no topo mostra em que etapa você está, quais já passaram e
permite pular direto para qualquer uma.

O arquivo é nomeado no padrão do laudo: `PLACA MARCA - PROPRIETÁRIO.pdf`.

### Campos com lista

Quatro campos são escolhidos em lista, não digitados:

| Campo | Lista |
|---|---|
| Categoria da CNH | ACC, A, B, C, D, E, AB, AC, AD, AE — lista fechada do CONTRAN |
| Combustível | nomenclatura do CRLV (Álcool, Gasolina, Álcool/Gasolina, Diesel, GNV, elétricos e híbridos) |
| Tipo | tipos de veículo do DENATRAN (Automóvel, Camioneta, Motocicleta, Reboque…) |
| Categoria | Particular, Aluguel, Oficial, Experiência, Aprendizagem, Missão Diplomática/Consular |

Combustível, Tipo e Categoria terminam em **Outro…**, que abre um campo livre —
cada Detran imprime variações, e uma lista fechada deixaria a pessoa sem saída.
Um valor que não esteja entre as opções (de um rascunho, por exemplo) reaparece
em "Outro…" com o texto preservado, em vez de sumir da tela.

### Validação de CPF

Os quatro campos de CPF (associado, proprietário e os equivalentes de cada
terceiro) conferem os dígitos verificadores ao sair do campo, rejeitando também
sequências repetidas como `111.111.111-11`. O erro aparece embaixo do campo e
some assim que o número é corrigido.

A validação **não bloqueia** a emissão: CPFs inválidos são listados na etapa de
revisão e no modal de confirmação, e a decisão de gerar mesmo assim é de quem
preenche.

### Terceiros

A etapa **Terceiros** aceita de zero a quantos forem necessários. Cada terceiro
adicionado gera no PDF os blocos de dados pessoais, dados do veículo, relato e
fotos. Sem terceiros, esses blocos simplesmente não aparecem.

### Fotos

Cada foto de veículo ocupa uma página inteira do PDF, na ordem definida na tela
(arraste no computador, ou use as setas ← → em qualquer aparelho).

As imagens são reduzidas a no máximo 1600 px e recomprimidas no navegador. Isso
mantém o PDF em poucos megabytes e, de quebra, **remove os metadados EXIF**
(geolocalização e modelo do aparelho) das fotos originais.

## Dados guardados no aparelho

Enquanto o formulário está sendo preenchido, um rascunho é mantido **apenas neste
navegador** — textos em `localStorage`, fotos em `IndexedDB` — para que um refresh
acidental não perca o trabalho.

Esse rascunho:

- é **apagado assim que o PDF é gerado**;
- **expira sozinho após 1 hora** sem alterações (com aviso 5 minutos antes);
- pode ser apagado a qualquer momento no menu (**Apagar rascunho deste aparelho**).

### Limitação conhecida da publicação atual

O site é publicado em `usuario.github.io/giro`. Nesse formato, **todos os
repositórios da mesma conta GitHub compartilham a mesma origem do navegador** —
outra página publicada nessa conta consegue, em tese, ler esse armazenamento
enquanto ele existe. A janela de 1 hora encurta muito a exposição, mas não a elimina.

A solução definitiva é publicar em **domínio próprio**, o que isola a origem:

1. crie um arquivo `CNAME` na raiz do repositório com o domínio (ex.: `laudo.exemplo.com.br`);
2. aponte um registro `CNAME` no DNS para `usuario.github.io`;
3. em *Settings → Pages*, marque **Enforce HTTPS**.

## Publicação

O projeto é HTML/CSS/JS puro — não há build.

1. Faça o commit dos arquivos na branch `main`.
2. Em *Settings → Pages*, selecione **Deploy from a branch**, branch `main`, pasta `/ (root)`.

O arquivo `.nojekyll` na raiz impede o Jekyll de processar o conteúdo.

## Identidade visual

Tudo o que é marca vive em [`js/brand.js`](js/brand.js): nome, CNPJ, WhatsApp,
caminhos dos assets e os tokens de cor. Editar esse arquivo muda **tela e PDF ao
mesmo tempo** — os tokens são publicados como CSS custom properties (`--giro-*`)
e lidos pelo gerador do PDF.

```js
GIRO.brand = {
  nome: 'GIRO PRONTA REAÇÃO',
  cnpj: '00.000.000/0001-00',   // substituir
  whatsapp: '(00) 00000-0000',  // substituir
  logo: 'assets/logo.png',      // cabeçalho da tela e de cada página do PDF
  cores: { accent: '#FA8706', band: '#22292C', /* ... */ }
};
```

O laranja `#FA8706` foi amostrado do próprio logotipo e o grafite `#22292C` do
bloco escuro do papel timbrado.

### Assets

| Arquivo | Origem | Onde aparece |
|---|---|---|
| `assets/logo.png` | `logo.jpeg`, com o fundo claro removido por preenchimento a partir das bordas | cabeçalho da tela e de **todas** as páginas do PDF |

O cabeçalho do PDF é tipográfico: logotipo à esquerda, título do documento à
direita e um fio fino separando do corpo. O logotipo entra no dicionário
`images` do pdfmake, então é embutido **uma única vez** por documento, e não a
cada página. Trocar a arte por outra de proporção parecida (322×155) dispensa
qualquer ajuste no código.

## Estrutura

```
index.html      formulário em 7 etapas, com trilha numerada no topo
css/giro.css    tema sobre o Bootstrap 5 (CDN)
js/brand.js     identidade — fonte única de nome, contatos e cores
js/state.js     modelo de dados do laudo, em memória
js/storage.js   rascunho efêmero (localStorage + IndexedDB) e limpeza
js/photos.js    orientação EXIF, redimensionamento e cache de preview
js/fonts.js     carga sob demanda das fontes do PDF
js/colar.js     leitura das consultas recebidas por WhatsApp
js/pdfdoc.js    montagem do documento (pdfmake)
js/form.js      navegação, ligação com o estado, terceiros e galerias
js/app.js       retomada, expiração, modal de confirmação e geração
assets/fonts/   Barlow, Barlow Condensed e Carlito, reduzidas ao latim
assets/logo.png logotipo com fundo transparente
```

## Desenvolvimento

```sh
python3 -m http.server 8080
```

e abra `http://localhost:8080`. Não abra por `file://` — o carregamento das fontes
usa `fetch`, que exige HTTP.

### Sobre as fontes

Todas sem serifa, para acompanhar o logotipo:

| Família | Uso |
|---|---|
| **Barlow Condensed** Bold | faixas de título dos blocos (títulos longos cabem em uma linha) |
| **Barlow** | subtítulos do parecer, rótulos em destaque e a interface da tela |
| **Carlito** | corpo de texto (métrica-compatível com Calibri, do modelo original em Word) |

Os arquivos em `assets/fonts/` foram reduzidos ao latim: **352 KB** no total,
contra ~7 MB das versões completas. O PDF os busca apenas na primeira geração; a
tela carrega só Barlow Regular/Bold e Barlow Condensed Bold, servidos localmente
— sem CDN de fontes.

Para regerar o subset a partir das fontes completas do
[google/fonts](https://github.com/google/fonts):

```sh
pip install fonttools
pyftsubset Barlow-Regular.ttf --output-file=assets/fonts/Barlow-Regular.ttf \
  --unicodes="U+0020-007E,U+00A0-00FF,U+0131,U+0152-0153,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20A0-20BF,U+2122,U+2190-2193,U+2212,U+25A0-25CF,U+2713" \
  --layout-features='kern,liga,ccmp,mark,mkmk' --no-hinting --desubroutinize
```

## Licenças

- [Bootstrap 5](https://getbootstrap.com) — MIT
- [pdfmake](https://pdfmake.github.io) — MIT
- Barlow e Barlow Condensed — SIL OFL 1.1 · Carlito — SIL OFL 1.1
