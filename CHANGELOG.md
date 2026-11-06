# Changelog

## 1.4.2 — 2026-11-06

Ajustes pedidos pela revisão manual do catálogo do Grafana.

- **Segurança do drill-down:** o link do elemento passa pelo `textUtil.sanitizeUrl`
  do Grafana depois de resolver as variáveis do dashboard. Endereços
  `javascript:`, `data:` e `vbscript:`, inclusive disfarçados com maiúsculas,
  tab ou quebra de linha, não viram mais link: o elemento fica sem clique, e o
  editor avisa "Endereço bloqueado por segurança". Caminhos do Grafana,
  `https://`, `http://` e `mailto:` continuam iguais.
- **Imagem só de `https://` ou upload.** A figura da Imagem carrega apenas URL
  `https://` e upload (`data:image/...`). Os ícones da biblioteca não mudam. Uma
  URL `http://` ou um caminho relativo já salvos continuam no dashboard, mas o
  canvas mostra "URL não permitida" no lugar da figura, e o editor explica a
  saída: baixar o arquivo e enviá-lo. O upload também passou a recusar arquivo
  que não é imagem.
- **Limite do upload também no schema.** Um upload acima de 256 KB que chegue
  por JSON ou importação perde só a figura. O resto do mapa carrega normalmente.
- Autor e copyright: "Matheus Domingos".

## 1.4.1 — 2026-10-10

Ajustes pedidos pela validação automática do catálogo do Grafana. **Nada muda
para quem usa o painel**: mesmo visual, mesmas opções, dashboards salvos
intactos.

- O CSS do React Flow deixou de ser importado como folha global. Agora é
  aplicado só dentro do canvas, com a mesma especificidade de antes, pela regra
  `no-direct-css-imports` do validador. Gerado por
  `scripts/gen-react-flow-css.js`.
- Ferramentas de teste e build: Jest 29 → 30, e o `eslint-webpack-plugin` saiu do
  webpack, que não fazia nada no build de produção. Os dois traziam o pacote
  `braces`, que tem um CVE sem correção (CVE-2026-93687). Segue a migração que o
  `create-plugin` vai lançar (grafana/plugin-tools#2945).
- `src/model/types.ts` sem `as const satisfies`, sintaxe que o Semgrep do
  validador não sabia ler.

## 1.4.0 — 2026-10-09

### ⚠️ Mudança de ID do plugin

O ID passou de `jlcp-topoflow-panel` para **`mdomingos-topoflow-panel`**. O
catálogo do Grafana exige que o prefixo do ID seja o slug da organização que
publica o plugin.

Quem instalou uma versão anterior (1.0 a 1.3) manualmente precisa fazer três
coisas:

1. Remover a pasta `jlcp-topoflow-panel/` do diretório de plugins e instalar a
   nova.
2. Trocar `jlcp-topoflow-panel` por `mdomingos-topoflow-panel` em
   `allow_loading_unsigned_plugins`, se usar o plugin sem assinatura.
3. Em cada dashboard que usa o TopoFlow, abrir *Settings → JSON Model*, trocar
   `"type": "jlcp-topoflow-panel"` por `"type": "mdomingos-topoflow-panel"` e
   salvar. As opções do painel (o mapa inteiro) são preservadas. Antes disso, o
   painel aparece como "plugin não encontrado".

### Layout novo, inteiro

O painel foi redesenhado a partir do mockup feito no Claude Design. Mudou a cara
de **todos** os elementos, do canvas e do editor. Fora a troca do ID (acima),
nada salvo precisa ser editado.

- **Paleta e tipografia próprias.** Escuro e claro do mockup, escolhidos pelo
  tema do Grafana, e **IBM Plex Sans/Mono embutidas no plugin** — funcionam em
  Grafana sem saída para a internet. As cores nomeadas que já estavam salvas
  (`red`, `orange`, `green`...) resolvem para os tons da paleta nova.
- **Nó:** cartão de cantos arredondados com um **círculo de status** no canto —
  `✓` na Base, `!` em alarme, `!!` em Disaster, `–` sem dados. O estado pinta a
  borda e tinge o fundo; o Disaster tem borda mais grossa e fundo mais saturado.
  Abaixo do nome, o bloco de valores: número grande com uma métrica, uma linha
  compacta por métrica com várias, e uma **barra com marcas onde cada threshold
  começa**.
- **Imagem:** o estado pinta o ícone e o círculo de status (que pousa no canto
  do desenho, não da caixa). O fundo é opcional e segue a cor do estado.
- **Point, Postit e Texto** no desenho novo — o Postit ganhou a etiqueta de
  título com a cor e as quatro alças de canto.
- **Conexões com seta**, tracejado proporcional à espessura e rótulo em cartão
  mono. Conexões entre o mesmo par se afastam e os rótulos vão para fora.
- **Controles, menu de contexto, avisos e popover de hover** no desenho do
  mockup. O hover mostra os incidentes (severidade, nome, idade) ou o gráfico —
  agora com as linhas de threshold da métrica e um gráfico por métrica.

### Biblioteca de ícones nova

- **Os packs em PNG e os glifos dos Clássicos saíram; entraram os desenhos SVG
  do mockup**: Padrão (28), Infra (43 — o antigo pack Zabbix, redesenhado),
  Petrolífera (9), Formas (15) e Planos (164). **Todo ícone acompanha o estado**:
  o mesmo roteador sai azul, verde ou vermelho.
- Topologias salvas abrem com o desenho equivalente: cada chave antiga
  (`router`, `classic/switch`, `topoflow/router`, `zabbix/rack-42`,
  `petrolifera/unifi-ac-mesh`...) é levada ao ícone novo. As quatro variantes de
  UniFi viraram uma só.
- O seletor de ícones virou uma janela com as pastas, a busca (com sinônimos) e a
  grade.
- Os ícones do Infra (ex-Zabbix) são arte própria: a pendência de licença GPL
  deixou de existir.

### Novidades

- **Várias métricas por elemento.** Cada uma com o próprio campo (ou host +
  item) e as próprias regras; vence a regra de maior gravidade — vermelho ›
  laranja › âmbar › sem dados › azul › verde. Uma métrica muda não se esconde
  atrás do verde de outra.
- **"Exibir valor" com várias métricas**: as do estado e quantas extras quiser.
- **Cinco formatos de problemas**: Dentro do nó, Faixa (barra segmentada por
  severidade), Contador (o número no círculo de status), Lista e Total. Os três
  primeiros vivem dentro do cartão, então são só do nó.
- **Vértices nas conexões.** Selecionada, a conexão mostra um `+` em cada
  segmento (arraste para criar um vértice) e os vértices existentes
  (arrastáveis; duplo clique ou Delete remove). Duplo clique na linha também
  cria. O menu de contexto ganhou "Adicionar vértice aqui", "Remover vértice" e
  "Limpar trajeto"; inverter a direção inverte o trajeto, e arrastar os dois
  extremos juntos leva os vértices junto.
- **Editor no desenho do mockup**: o cartão do elemento aberto (com Duplicar,
  Excluir e fechar), seções com título, a lista "Elementos" agrupada por tipo com
  a cor do estado de cada um.

### Mudanças de comportamento

- **"Adicionar elemento" e o menu do canvas não oferecem mais Point**, como no
  mockup: o trajeto das conexões cumpre o papel que ele tinha. Points salvos
  continuam funcionando e editáveis.
- O fundo novo da Imagem segue o estado; o fundo sólido de antes continua
  valendo para quem o tem salvo.
- O seletor "Cor do ícone" saiu (no mockup o ícone sempre acompanha o estado); a
  cor fixada antes continua respeitada.

### Rodada de correções antes da submissão (2026-10-10)

- **Agrupar elementos.** Com dois ou mais elementos selecionados, o botão direito
  oferece **Agrupar**. O clique num membro seleciona o grupo inteiro, e arrastar
  um arrasta todos. No membro, o botão direito oferece **Desagrupar**. A cópia
  de um membro nasce fora do grupo. Topologias salvas antes disso não mudam (o
  campo `groupId` é opcional).
- **Conexão nos dois sentidos.** Com A → B já ligado, agora dá para criar
  B → A. Só o mesmo sentido repetido continua sendo recusado. As duas aparecem
  como paralelas.
- **Linhas alinhadas ao grid.** Com o encaixe ligado, nó, point e imagem
  encaixam pelo **centro**, que é de onde a conexão sai. Dois elementos de
  tamanhos diferentes na mesma linha do grid passam a dar uma conexão reta. Os
  vértices das conexões também encaixam no grid. Postit e texto continuam
  encaixando pelo canto.
- **Padrões de elemento novo:** Base verde (`#22C55E`) em nó, point, imagem e
  conexão; ícone **Roteador** no nó; Figura da Imagem na **Biblioteca**, já com o
  Roteador. "Definir cor" na Base também usa o verde. Elementos já salvos não
  mudam.
- **Mesma bolinha de cor do Grafana em todo o editor:** na escada de
  severidades, na Cor do Postit, na Cor e na Cor do fundo do Texto.
- **Thresholds: o valor só grava ao sair do campo (ou no Enter).** Antes, cada
  tecla reordenava a lista, e o número seguinte caía na regra vizinha. Também
  não dava para apagar o campo para digitar outro valor.
- **Hover:** o gráfico não abre mais no modo de edição. O desenho passou a ser o
  mesmo para uma métrica ou várias (nome e último valor no topo de cada
  gráfico): o hover da Imagem e do Point ficou igual ao do Nó.
- **Itens de texto do Zabbix.** O catálogo passa a listar itens de caractere,
  log e texto, e o painel os busca pelo modo _Text_ do datasource. Eles servem
  em "Exibir valor", em `${...}` e nas regras de Valor e Regex. O gráfico avisa
  que métrica de texto não tem gráfico.
- **"Exibir valor" com host e item do Zabbix.** Cada métrica extra oferece
  "Usar um campo da query" ou "Escolher host e item no Zabbix", como no
  Estado. Isso vale também para nó em modo Trigger. As métricas extras passaram
  a entrar na query do painel; antes, uma métrica escolhida ali nunca era
  buscada.
- A seção **Zabbix** do painel de opções virou **Zabbix API**.
- **Duplicar abre a cópia.** Pelo cartão, pela lista ou pelo menu do canvas, a
  cópia sai selecionada e com o cartão aberto. Antes o cartão continuava no
  original, e como a cópia nasce por cima dele, quem seguia editando mexia no
  original achando que mexia na cópia. A cópia também passou a ser profunda (não
  compartilha nenhum objeto com o original), e trocar de elemento recria o
  formulário, sem levar o estado dos campos de um para o outro.
- **Várias métricas de estado pelo Zabbix API.** Da segunda métrica em diante,
  o elemento ficava "sem dados" mesmo com o Zabbix coletando: só a primeira
  entrava na query do painel. Agora todas entram.
- **O menu de Host e Item não se espalha mais pela tela.** A chave do item
  (descrição de cada opção) é encurtada pelo meio. O menu do Grafana toma a
  largura da opção mais longa, e uma chave de contador do Windows o deixava da
  largura do canvas.

## 1.3.0 — 2026-09-10

### O painel busca os próprios problemas

- **A seção _Zabbix_ virou um interruptor.** Ligada, o editor sugere hosts e
  triggers do catálogo **e** o painel executa a própria query de Problems para os
  hosts vinculados — o que **dispensa a query no dashboard**, que é o trabalho
  manual que esta rodada inteira existe para eliminar. Desligada, e é o padrão,
  tudo vem das queries do dashboard, como sempre veio.
- **Vale para os dois vínculos: trigger e métrica.** Uma query só de _Problems_
  para o mapa inteiro, por mais elementos que ele tenha, e uma query de métrica
  por host, com os itens daquele host. Os problemas não ficam presos à janela de
  tempo do dashboard: um alarme aberto há oito horas continua visível com o
  dashboard em "últimas 6 horas".
- Unidade, casas decimais e value mappings do painel **continuam valendo** nas
  séries que o painel busca, e passam a valer na hora em que são editados, sem
  ir buscar o dado de novo.
- Atualiza no refresh do dashboard (botão, intervalo automático) e ao mudar a
  janela de tempo.
- Com a seção ligada, os problemas que vierem de uma query do dashboard **cedem
  lugar** aos do painel: as duas fontes trazem os mesmos alarmes, e somadas
  fariam cada um contar duas vezes. As séries de métrica do dashboard continuam
  valendo.
- O aviso "nenhuma query de Problems neste painel" some com a seção ligada — ele
  mandava resolver um problema que o usuário acabou de dispensar.
- Falha ao atualizar **preserva o último estado** e avisa no topo do painel —
  num telão, apagar o mapa é pior que mostrar o estado de um minuto atrás.

### Biblioteca de ícones: pack Zabbix

- **O conjunto de ícones dos mapas do Zabbix entrou na biblioteca**, inteiro: 43
  desenhos numa pasta *Zabbix*, entre *Clássicos* e *Petrolífera*. Quem já montou
  o mesmo mapa no Zabbix reconhece cada um sem ler o rótulo.
- Mais um **AP**, que o conjunto do Zabbix não tem: é a mesma foto do UniFi AC
  Lite que já estava no pack *Petrolífera*. São 44 na pasta.
- Roteador, switch, hub, firewall, modem, nuvem, satélite, SAN, PABX, estação,
  notebook, impressora — e as versões **símbolo** do roteador, do roteador cripto
  e do PABX IP, que são o desenho esquemático em vez do equipamento.
- Vieram junto as peças de **elevação de rack** (servidores 1U a 5U, no-break de
  rack, array de discos e servidor Zabbix, cada um em 2D e 3D, mais os dois racks
  de 42U). São tiras muito largas: num nó de 20px viram um fio. O lugar delas é o
  elemento **Imagem**, que tem tamanho livre e onde dá para empilhar uma
  elevação — e por isso 2D e 3D estão os dois, já que uma pilha só fecha se todas
  as peças estiverem na mesma projeção.
- Como no pack *Petrolífera*, são figuras com cor própria: **não anunciam
  estado** (quem anuncia é a placa da cápsula, atrás delas) e o campo "Cor do
  ícone" não aparece para eles.
- **Pendência de licença.** Estes ícones são GPL-2.0 e o plugin é Apache-2.0.
  Enquanto isso não se resolver, o plugin não deveria ser assinado e publicado
  com eles. Ver [doc 09](docs/09-pendencias-e-roadmap.md).

### Correções e ajustes de ícone

- **A Torre do pack _Petrolífera_ é outra arte**: uma torre de telecom com
  refletores, no lugar do pictograma de antena que estava lá. As duas versões
  antigas saíram.

### Melhorias

- **Os seletores de métrica do editor passam a oferecer o Zabbix.** "Inserir
  métrica", "Exibir valor" e o modo _Field_ dos textos listam, junto com o que
  veio das queries, o que já está vinculado **e o catálogo de itens numéricos dos
  hosts que o mapa usa** — carregado ao abrir o combo, em lotes, e reaproveitado
  por 30 segundos. Antes, nada disso existia ali: o campo prometia o que não
  entregava.
- **O painel busca também a métrica que só um texto menciona.** Todo
  `${host: item}` escrito num rótulo, legenda ou texto entra na query, assim como
  o field escolhido em "Exibir valor". Nome que não corresponda a um host do
  Zabbix é descartado sem custo.
- **Fim dos dois avisos que mandavam resolver o que a seção já resolveu**: nem
  "essa métrica não está nas queries do painel" no vínculo por métrica, nem
  "sem correspondência nas séries" para uma métrica que o painel busca e exibe.

- **"Exibir valor" sem métrica escolhida passa a mostrar a do estado** — a mesma
  que pinta o elemento —, em vez de um travessão. É o que o toggle promete, e é
  a única saída quando a métrica foi escolhida por host + item: nesse caso a
  série só existe quando o painel busca sozinho, e o seletor de field lista
  apenas o que veio das queries do dashboard.

### Correções

- **A lista de hosts do combo não é mais espaçada.** Todas as linhas vinham com
  altura de duas, a segunda em branco: o `Combobox` decide a altura por presença
  da _chave_ `description`, e nós a mandávamos sempre, mesmo vazia.

## 1.2.0 — 2026-09-09

### Vínculo direto com o Zabbix

- **Datasource do Zabbix nas opções do painel** (seção _Zabbix_). Serve ao
  editor: com ele configurado, os combos passam a sugerir o catálogo do Zabbix
  em vez de apenas o que as queries já trouxeram. Havendo exatamente um
  datasource Zabbix na instância, ele é adotado sozinho e o campo pode ficar
  vazio. Os dados que pintam o mapa continuam vindo das queries do painel.
- **Host e trigger com busca**, no vínculo por trigger. Um host sem problema
  ativo — que antes não aparecia em lista nenhuma — passa a ser escolhível. O
  que veio dos frames e não voltou da API continua na lista: nenhuma escolha já
  possível deixou de ser possível.
- **Modo Métrica por host + item.** O seletor de campo dá lugar a dois combos
  alimentados pelo Zabbix, e o elemento passa a guardar host e item em vez do
  nome da série (`color.metric`). É o que permite vincular **antes** de existir
  query. O caminho antigo continua a um clique de distância, em "Usar um campo
  da query", e tudo o que está salvo com `color.field` segue valendo sem
  migração.
- Falha ao consultar o Zabbix (sem permissão, fora do ar, plugin ausente) volta
  ao comportamento anterior com um aviso no formulário — nunca com erro dentro
  do combo. Digitar host, trigger e item à mão continua valendo em qualquer
  cenário.

### Vínculo de trigger

- **Mais de uma trigger por elemento.** O campo único virou uma lista: um host, e
  abaixo dele quantas triggers o elemento precisar, com `+ Adicionar trigger` e
  um `x` por linha. A relação é **OU** — basta uma alarmar para o elemento
  acender, e as que alarmarem juntas aparecem todas na lista sob o elemento e no
  contador; a cor segue a maior severidade entre elas.
- **Deixar a lista com uma linha só é o comportamento de sempre**, inclusive a
  opção "Qualquer trigger do host", que fica escondida a partir da segunda linha
  (ali ela revogaria as outras em vez de escolher entre elas).
- Topologias salvas antes disto carregam sem migração: a trigger que estava no
  campo `name` vira a primeira linha da lista.

### Lista de triggers ativas

- **Formato da lista: Lista ou Total.** Em **Total**, as até três linhas com os
  nomes viram uma só — "4 incidentes ativos" —, de altura fixa para qualquer
  número de alarmes, para a topologia densa em que importa _quanto_ está caindo.
  A linha veste a maior severidade em curso, e os nomes continuam no tooltip e
  no painel de hover. O campo fica junto de "Posição da lista", e some com a
  lista desligada. **Lista** segue sendo o padrão: nenhuma topologia salva muda
  de aparência.

## 1.1.0 — 2026-09-04

### Identidade

- **Logo próprio**, no lugar do placeholder do `create-plugin`. Dois arquivos:
  `img/logo.svg` (marca cheia, com as cápsulas de ícone vazadas por máscara) e
  `img/logo-small.svg` (traços engordados, para 16–24 px no seletor de
  visualização). As cores são literais de propósito — o Grafana carrega o logo
  via `<img>`, então o SVG não enxerga o tema, e o desenho precisa funcionar
  sobre `#111217` e `#F4F5F5`.

### Dashboards de exemplo

- **Dois modelos novos**, estáticos e prontos para copiar:
  `topoflow-modelo-datacenter.json` (quatro faixas, com os ícones da biblioteca
  Padrão) e `topoflow-modelo-wan.json` (núcleo e seis filiais, só com nós).
  Ambos desenhados na proporção de um painel de largura cheia, com dois
  problemas simulados cada um.
- **Nomes e endereços fictícios** no exemplo estático: hosts genéricos e faixas
  reservadas para documentação (RFC 5737 e RFC 1918).
- **`topoflow-exemplo-com-dados.json` removido.**

## 1.0.0 — 2026-09-02

Primeira versão.

### Canvas e edição

- Seis tipos de elemento: nó, point, conexão, imagem, postit e texto.
- Criar, arrastar, redimensionar, duplicar, deletar, reordenar e conectar, por
  menu de contexto ou pelo painel de Layers.
- Seleção múltipla com **edição em massa** de conexões e points.
- Seleção sincronizada entre o canvas e o painel de Layers.
- Grid com snap configurável; edição inline opcional fora do editor de painel.

### Vínculo com dados

- Modo **Métrica**: campo escolhido por display name, com bloco de regras
  próprio — threshold, valor exato, faixa, regex e casos especiais.
- Modo **Trigger**: host e trigger do Zabbix lidos de uma query em Query Mode
  _Problems_, com cores por severidade e severidades desligáveis.
- Templates `${nome do field}` em textos, rótulos de conexão e legendas.
- Animação de alerta por regra: pulsar, piscar e radar, sob
  `prefers-reduced-motion`.

### Leitura

- Lista de triggers em PROBLEM fixa junto ao elemento, com posição escolhível.
- Painel de hover: tabela de incidentes (modo Trigger) ou gráfico da métrica na
  janela de tempo do dashboard (modo Métrica).
- Drill-down por elemento, com variáveis interpoladas no clique.
- Screenshot da topologia em PNG.
- Biblioteca de ícones com pastas: `topoflow` (variantes por estado), `classic`
  (glifos) e `petrolifera` (ativos de campo).

### Notas de atualização

- **A topologia de exemplo saiu do default.** Um painel novo nasce com o canvas
  vazio. Painéis já salvos não são afetados.
- **Os thresholds e value mappings nativos do Grafana não pintam mais o
  elemento** — quem pinta é o bloco de regras do próprio elemento. Um elemento
  que dependia do threshold do _field_ para acender passa a exibir a cor Base até
  ganhar a regra equivalente no bloco dele. Eles continuam formatando o valor
  exibido e colorindo o gráfico do hover.
