# 10 — Submissão ao catálogo do Grafana

Como publicar o TopoFlow no [catálogo de plugins](https://grafana.com/grafana/plugins/)
do Grafana, e o diário de cada submissão já feita. Escrito na primeira submissão
(v1.4.0, outubro de 2026) para que as próximas não precisem redescobrir nada.

Fontes oficiais, que valem mais que este documento se divergirem:

- [Publish or update a plugin](https://grafana.com/developers/plugin-tools/publish-a-plugin/publish-a-plugin)
- [Publishing best practices](https://grafana.com/developers/plugin-tools/publish-a-plugin/publishing-best-practices)
- [Help us test your plugin](https://grafana.com/developers/plugin-tools/publish-a-plugin/provide-test-environment)
- [Sign a plugin](https://grafana.com/developers/plugin-tools/publish-a-plugin/sign-a-plugin)
- [Critérios de publicação e assinatura](https://grafana.com/legal/plugins/)
- [FAQ de publicação](https://grafana.com/developers/plugin-tools/publish-a-plugin/publish-faqs)

## Visão geral do fluxo

```text
tag vX.Y.Z ──► GitHub Actions (release.yml) ──► draft release com .zip + .zip.sha1
                                                   │
                         publicar o draft release ◄┘
                                   │
grafana.com ► My Plugins ► Submit New Plugin (ou Submit Update)
   URL do .zip · URL do código (tag) · SHA1 · testing guidance
                                   │
validação automática ► fila ► revisão manual (código + teste num Grafana deles)
                                   │
                aprovado ► publicado no catálogo e assinado pela Grafana
```

Não há prazo de revisão: a Grafana não estima nem agenda data de publicação.

## Pré-requisitos (bloqueiam a submissão)

| # | Requisito | Por quê |
| --- | --- | --- |
| 1 | **Repositório público no GitHub** | Plugins Community "must already exist in a public Git repository". O campo *Source code URL* e o link do zip na release precisam abrir sem login. |
| 2 | **Prefixo do ID = slug da org que envia**, com você como **Admin** dela | O ID `mdomingos-topoflow-panel` tem prefixo `mdomingos`, o slug da org usada no grafana.com. O envio exige que os dois batam. O validador (`org`) confere se a org existe, e a assinatura sai em nome dela (`signedByOrg`). Só admin da org vê **My Plugins**. |
| 3 | Licença compatível | Apache-2.0, MIT, BSD, GPL-3.0, LGPL-3.0 ou AGPL-3.0. O TopoFlow é Apache-2.0. |
| 4 | `plugin-validator` sem erros | A Grafana roda o mesmo validador na entrada; o `release.yml` também roda. |
| 5 | Ambiente de teste provisionado | Opcional, mas reduz muito o tempo de revisão. Já existe: `docker-compose.yaml` + `provisioning/` com TestData e dashboards. |

> **Depois de publicado, o ID não muda mais.** Trocar o ID quebra todo dashboard
> salvo com o `"type"` antigo. Isso já aconteceu uma vez: o plugin nasceu como
> `jlcp-topoflow-panel`, mas a org `jlcp` no grafana.com já existia e não
> pôde ser usada. Na v1.4.0, antes da primeira publicação, o ID virou
> `mdomingos-topoflow-panel`. A migração está no `CHANGELOG.md`. Em plugin novo,
> confira o slug da org **antes** de escolher o ID.

### Classificação: Community ou Commercial

O nível de assinatura sai das respostas do formulário:

- **Community** (grátis): open source, "not commercial in nature and not
  affiliated with any commercial endeavor".
- **Commercial** (exige assinatura paga do Grafana): "offered in connection with a
  commercial offering, commercial dependencies or offered by a for-profit
  business".

O formulário atual faz duas perguntas: afiliação com o produto integrado e
integração com produto comercial. Ver o passo 5.

## Passo a passo

Comandos no ambiente deste projeto: commit e tag pelo git do WSL, push pelo git
do Windows, porque o git do WSL trava esperando credencial.

### 1. Conta e organização no grafana.com

1. Entre em <https://grafana.com/auth/sign-in>. Se não tiver conta, crie uma; o
   plano Free do Grafana Cloud basta.
2. Descubra o **slug** da sua org: é o que aparece na URL
   `https://grafana.com/orgs/<slug>/...`, e não o nome de exibição. O do TopoFlow
   é **`mdomingos`**. **Não confie** em `curl https://grafana.com/api/orgs/<slug>`:
   sem login ele responde "Org not found" até para org existente.
3. O ID do plugin precisa começar com esse slug (`<slug>-<nome>-panel`). Se não
   começar, há três saídas:
   - entrar como Admin na org do prefixo, por convite de quem a administra;
   - pedir ao suporte (*Support → Get Support*) a troca do slug;
   - trocar o ID, que foi o que fizemos.
4. Você precisa ser **Admin** dessa org.

### 2. Tornar o repositório público

GitHub → `MathewsJLCP/mdomingos-topoflow-panel` → **Settings** → **General** →
*Danger Zone* → **Change repository visibility** → **Public**.

Antes de abrir, verifique se há segredos. Em 2026-10-10 foram verificados os
arquivos versionados e todo o histórico (tokens `glsa_`, `ghp_`,
`github_pat_`, chaves de API e senhas): nada encontrado. Os IPs nos `examples/`
são de faixas privadas ou de documentação. `temp/` e `releases/` não são
versionados.

### 3. Validar

```bash
npm run build
# zip com a pasta mdomingos-topoflow-panel/ na raiz — ver docs/07
npx @grafana/plugin-validator@latest -sourceCodeUri file://. releases/mdomingos-topoflow-panel-X.Y.Z.zip
```

O validador também roda o **osv-scanner** sobre o `package-lock.json` inteiro,
**inclusive as dependências de dev**. CVE de severidade alta ou crítica vira
**erro**. Os únicos ignorados são os pacotes trazidos pelos `@grafana/*` e uma
whitelist mínima. Como surgem CVEs novos toda semana, um lockfile que passou
ontem pode reprovar hoje. Rode o validador **no dia** da tag.

Para corrigir, nesta ordem:

1. `npm audit fix` (sem `--force`): atualiza o lockfile dentro das faixas do
   `package.json`.
2. O que sobrar e tiver versão corrigida, mas preso por faixa de um pacote
   intermediário: `"overrides"` no `package.json`.
3. O que não tiver versão corrigida **bloqueia mesmo assim**: a Grafana não
   aceitou explicação no *Testing guidance* (v1.4.0). É preciso tirar o pacote
   do lockfile, trocando ou removendo quem o traz.

**O validador local não roda o Semgrep** (as regras `code-rules` e o
`scan-incomplete`), a menos que o `semgrep` esteja instalado. O da Grafana roda.
Para reproduzir localmente com Docker e as mesmas regras:

```bash
curl -s https://raw.githubusercontent.com/grafana/plugin-validator/main/pkg/analysis/passes/coderules/semgrep-rules.yaml -o /tmp/semgrep-rules.yaml
docker run --rm -v "$PWD":/src -v /tmp/semgrep-rules.yaml:/rules.yaml -w /src \
  semgrep/semgrep semgrep --metrics=off --config /rules.yaml src
```

Rode a partir da raiz do repositório e passe `src` como alvo: as regras filtram
por `src/**`. Duas pegadinhas:

- A regra `no-direct-css-imports` é uma **regex**. Ela pega até um comentário
  que contenha o texto de um import de `.css`.
- O Semgrep da Grafana é **mais antigo** que o da imagem atual. Sintaxe nova de
  TypeScript (`as const satisfies`) aborta a varredura do arquivo inteiro, e o
  erro (`scan-incomplete`) só aparece lá.

Avisos que podem ser ignorados:

- "unsigned plugin": normal na primeira submissão;
- `react/jsx-runtime`: falso positivo, porque ele é externo;
- link do LinkedIn "possibly broken (999)": o LinkedIn bloqueia robôs, e o link
  funciona no navegador.

#### Achados do validador e tratamento (v1.4.0 → v1.4.1)

| Achado | Origem | Tratamento |
| --- | --- | --- |
| 6 pacotes com CVE alto (`fast-uri`, `js-yaml`, `nanoid`, `source-map-js`...) | lockfile defasado | `npm audit fix` |
| `basic-ftp` ≤ 6.2.0 (CVE-2026-102990) | `@grafana/sign-plugin` → `proxy-agent` → `get-uri`, que fixa `^5` | `"overrides": { "basic-ftp": "^6.2.3" }`. O FTP nunca é usado pelo `sign-plugin`. |
| **`braces` ≤ 3.0.3 (CVE-2026-93687)** | `micromatch` ← `eslint-webpack-plugin` (webpack de `.config/`) e `jest` 29 | Sem versão corrigida, e **a Grafana bloqueou** mesmo sendo só de dev. Na **1.4.1** o `braces` saiu do lockfile: Jest 30, que usa `picomatch`, e remoção do `eslint-webpack-plugin` do `.config/webpack`. É a migração oficial que o `create-plugin` vai lançar (grafana/plugin-tools#2945). Quando ela for lançada, o `create-plugin update` deve deixar o `.config` igual ao nosso. |
| CSS global do React Flow (`import '@xyflow/react/dist/style.css'`) | regra `no-direct-css-imports` (Semgrep) | Na 1.4.1 o CSS virou string escopada no wrapper do canvas, com `:where(&)` para manter a especificidade, gerada por `scripts/gen-react-flow-css.js`. **Rodar de novo ao atualizar o `@xyflow/react`.** |
| `as const satisfies` em `src/model/types.ts` | `scan-incomplete` (Semgrep antigo da Grafana) | Na 1.4.1 virou `as const` mais um tipo de checagem (`AssertCollection`). |

### 4. Tag e release pelo GitHub Actions

A versão do `package.json` e a tag precisam coincidir (`1.4.0` ↔ `v1.4.0`).

```bash
# WSL
wsl.exe -d Ubuntu -- bash -c "cd ~/TopoFlow/jlcp-topoflow-panel && git checkout master && git tag -a v1.4.0 -m 'v1.4.0'"
# Windows
git -c safe.directory=* push origin v1.4.0
```

O `release.yml` (`grafana/plugin-actions/build-plugin`) compila, roda o
validador e cria uma **draft release** com:

- `mdomingos-topoflow-panel-1.4.0.zip`
- `mdomingos-topoflow-panel-1.4.0.zip.sha1`

Abra **Actions** → *Release* e confira o passo *Validate plugin*. Depois vá em
**Releases**, edite o draft (cole a seção da versão do `CHANGELOG.md`) e clique
em **Publish release**. Enquanto a release for draft, os links de download dão
404 para a Grafana.

> **Use o zip da release, não o de `releases/` local.** Cada build gera um zip com
> SHA-1 diferente. O SHA-1 informado tem que ser o do arquivo que está na URL.

### 5. Formulário de submissão

`https://grafana.com/orgs/<slug-da-org>/plugins` → **Submit New Plugin**. No caso
de uma atualização, o botão é **Submit Update**, ao lado do plugin.

> **O slug da org que envia tem que ser o prefixo do ID** (`mdomingos`). O slug aparece
> na URL (`/orgs/<slug>/...`) e é diferente do nome de exibição. Enviar pela org
> `mdomingos` um plugin `jlcp-...` dá "Org not found" (foi o que levou à troca do ID).

A tela em outubro de 2026 (*Create Plugin Submission*) difere da documentação:
não há "OS & Architecture" e as perguntas de classificação são outras.

| Campo da tela | Valor |
| --- | --- |
| How do you want to list your plugin? | **Public (free)** |
| Plugin (zip file) → *Paste a URL* | `https://github.com/MathewsJLCP/mdomingos-topoflow-panel/releases/download/v1.4.1/mdomingos-topoflow-panel-1.4.1.zip` |
| MD5 or SHA1 (URL also accepted) | `https://github.com/MathewsJLCP/mdomingos-topoflow-panel/releases/download/v1.4.1/mdomingos-topoflow-panel-1.4.1.zip.sha1`. A URL elimina o risco de colar o hash errado. |
| Source code → *Paste a URL* | `https://github.com/MathewsJLCP/mdomingos-topoflow-panel/tree/v1.4.1` (sempre a **tag**, não a branch) |
| Testing guidance | texto abaixo |
| Provisioning provided for test environment | **Yes** |
| Are you affiliated with the project/product the plugin integrates with? | **No**: você não faz parte da Zabbix LLC |
| Does the plugin integrate with a commercial product? | **No**: integra com o Zabbix (open source) e com o datasource Zabbix da comunidade |

Com as duas últimas respostas em **No**, o plugin entra como **Community**.

#### Testing guidance (colar no formulário)

```text
TopoFlow is a frontend-only panel plugin (no backend, no data source of its own).

Quick start with the provisioned environment:
  git clone https://github.com/MathewsJLCP/mdomingos-topoflow-panel && cd mdomingos-topoflow-panel
  git checkout v1.4.1
  npm ci && npm run build
  docker compose up --build
  open http://localhost:3000  (anonymous admin enabled)

Provisioned dashboards (TestData data source is provisioned too):
  - "Provisioned TopoFlow dashboard": a sample topology bound to TestData metrics.
  - "TopoFlow — mockup v1.4": a denser network map with nodes, links,
    groups, text and images.

What to try:
  1. Open a dashboard: nodes and links are colored by the TestData metrics;
     hover a node to see its metric chart.
  2. Edit the panel: right-click the canvas to add nodes, links, groups, text and
     images; drag, resize and connect elements; select several to bulk-edit.
  3. In the options pane, bind an element to a metric field and set thresholds;
     the map recolors live.
  4. Save, reload: the whole map is stored in the panel JSON.

Zabbix trigger binding is optional and needs the Zabbix data source
(alexanderzobnin-zabbix-app); everything else works with TestData only.
More example dashboards: examples/ in the repository.
Requires Grafana >= 12.3.0.
```

> Antes de colar, confira se os nomes dos dashboards provisionados ainda batem
> com `provisioning/dashboards/*.json`.

### 6. Depois de enviar

1. A Grafana roda a validação automática. Se falhar, a submissão volta com o motivo.
2. A submissão entra na fila. A revisão manual cobre o código e um teste num
   Grafana deles, que podem pedir ajuda para montar o ambiente.
3. As mensagens chegam por e-mail e na própria página **My Plugins**. Responda
   por lá.
4. Aprovado, o plugin vai para o catálogo **já assinado pela Grafana**. A página
   do catálogo mostra o `src/README.md`. Para mudar a página, só enviando uma
   versão nova.

## Atualizações futuras (v1.5+)

1. Suba a versão em `package.json`, escreva a entrada no `CHANGELOG.md` e faça o
   merge em `master`.
2. Dispare a release com tag `vX.Y.Z` (passo 4).
3. **A partir da segunda submissão, o zip precisa vir assinado.** Só a primeira
   submissão é isenta. Configure uma vez:
   - grafana.com → org `mdomingos` → **Access Policies** → criar token com realm
     `mdomingos` (all-stacks) e escopo **`plugins:write`**.
   - GitHub → *Settings* → *Secrets and variables* → *Actions* → novo secret
     `GRAFANA_ACCESS_POLICY_TOKEN`.
   - No `.github/workflows/release.yml`, descomentar
     `policy_token: ${{ secrets.GRAFANA_ACCESS_POLICY_TOKEN }}`.
4. Em **My Plugins**, clique em **Submit Update** e preencha com a URL, a tag e o
   SHA-1 da release nova.

## Armadilhas

- **GitHub Actions desligado.** A tag sobe, mas nenhuma release aparece, e a aba
  Actions mostra "no workflow runs". São **dois** interruptores:
  1. *Settings → Actions → General* em **Allow all actions and reusable
     workflows**: o `release.yml` usa actions de terceiros (`grafana/plugin-actions`).
  2. **Abrir a aba Actions logado.** Se aparecer "Workflows aren't being run on
     this repository", clique em **Enable Actions on this repository**. Esse
     interruptor **não aparece em Settings**, e a API ainda responde
     `enabled: true`. Foi a causa no TopoFlow.

  Sintoma típico: o commit não tem check suite do `github-actions`
  (`GET /repos/{repo}/commits/master/check-suites`). Depois de habilitar,
  reenvie a tag para disparar o workflow: `git push origin :refs/tags/vX.Y.Z` e
  então `git push origin vX.Y.Z`. Sem Actions, a release também pode ser
  montada à mão: zip local, assinado com
  `GRAFANA_ACCESS_POLICY_TOKEN=... npx @grafana/sign-plugin` antes de zipar, e
  publicado pela interface web.
- **SHA-1 de outro zip.** Rebuild local ≠ zip da release. Copie o hash do
  `.zip.sha1` publicado.
- **Release ainda em draft.** O link do zip dá 404 para o validador da Grafana.
- **Source code URL na branch.** Use a tag. A branch anda, e o revisor vê código
  que não é o do zip.
- **Editar `dist/`.** `dist/plugin.json` e `dist/LICENSE` são gerados pelo build.
  A fonte é `src/plugin.json` e o `LICENSE` da raiz.
- **Mudar o `plugin.json`** pede reinício do Grafana para valer no ambiente local.
- **README de catálogo com jargão de dev** (`npm`, `yarn`...). O validador avisa.
  Instruções de desenvolvimento ficam no `README.md` da raiz, não no `src/README.md`.

## Diário de submissões

Uma entrada por evento, a mais recente embaixo. Registre data, o que foi feito e
a resposta da Grafana, inclusive pedidos de ajuste do revisor e como foram
resolvidos.

### v1.4.0 — primeira submissão

| Data | Evento | Resultado / observação |
| --- | --- | --- |
| 2026-10-10 | v1.4.0 fechada em `master` (`4efcea8`) | plugin-validator: 0 erros |
| 2026-10-10 | Checagem de pré-requisitos | Repo **privado** (GitHub 404 sem login); org **`jlcp`** não encontrada pela API pública (depois se viu que a checagem não vale: ela existe, mas não pôde ser usada); sem segredos no repo nem no histórico; provisioning OK |
| 2026-10-10 | Repositório tornado público | GitHub 200, issues habilitadas |
| 2026-10-10 | `src/plugin.json`: autor corrigido (`Matheus Domingos - Jlcp`) e com URL do LinkedIn; `links` com Issues e LinkedIn | validador: aviso "999" do LinkedIn (anti-robô), ignorável |
| 2026-10-10 | Validador passou a reprovar por CVEs novos no lockfile | `npm audit fix` + override do `basic-ftp`; resta só `braces` (sem correção, ver acima). typecheck, 893 testes e build OK |
| 2026-10-10 | Tentativa de criar a org `jlcp` | A conta já existia com a org de slug **`mdomingos`**, e o slug não pôde ser escolhido. O formulário de submissão foi aberto em `grafana.com/orgs/mdomingos/plugins`, mas **não foi enviado**, porque o prefixo do ID (`jlcp`) não bate com o slug. A API pública `/api/orgs/<slug>` responde "Org not found" até para org existente, então não serve de prova. |
| 2026-10-10 | Org `jlcp` existe, mas não pôde ser usada | **ID trocado para `mdomingos-topoflow-panel`** (src/plugin.json, provisioning, examples, docs, CI; `docker-compose.yaml` sobrescreve o ID antigo que `.config/` ainda traz). Versão mantida em 1.4.0, nunca publicada; migração no CHANGELOG |
| 2026-10-10 | Grafana local recriado com o ID novo | plugin carrega (`/api/plugins/mdomingos-topoflow-panel`), sem erros de plugin; os dois dashboards provisionados renderizam; validador 0 erros novos (só `braces`) |
| 2026-10-10 | Tag `v1.4.0` (commit `00512ff`) enviada ao GitHub | **Nenhum workflow rodou**: a aba Actions mostra "There are no workflow runs yet", e o CI nunca rodou neste repo. O Actions está desativado no repositório. |
| 2026-10-10 | Conferência do Actions | *Settings → Actions → General* já estava em **Allow all actions and reusable workflows**; githubstatus sem incidente; a API lista só o `ci.yml` como workflow e 0 execuções. Causa ainda não identificada; o teste é reenviar a tag. |
| 2026-10-10 | Repositório renomeado no GitHub: `jlcp-topoflow-panel` → **`mdomingos-topoflow-panel`** (feito pelo usuário em *Settings → General*) | URLs do `plugin.json` (Issues) e deste documento atualizadas; o GitHub redireciona as antigas. A pasta local continua `~/TopoFlow/jlcp-topoflow-panel`. Tag `v1.4.0` movida para o commit com as URLs novas (ela nunca gerou release). |
| 2026-10-10 | Push de `e5860c3` no master (repo já renomeado) | CI **de novo não disparou** (0 execuções após 90 s). O bloqueio é de conta ou de Actions, não do repositório. |
| 2026-10-10 | Plano B: zip gerado localmente a partir de `e5860c3` | `releases/mdomingos-topoflow-panel-1.4.0.zip`, SHA-1 `32a7f7921a5f5c4ff99337ee6e75697e6c3e4ec1`, 30 arquivos com a pasta do ID na raiz. Validador: só o `braces`. |
| 2026-10-10 | Tag `v1.4.0` recriada em `e5860c3` (o usuário apagou a antiga) | O Actions **ainda não dispara**, nem na tag. A criação da release pela API foi barrada pelo controle de permissões do Claude Code. |
| 2026-10-10 | Release `v1.4.0` publicada pelo usuário na interface web, com o zip e o `.sha1` gerados localmente | Download conferido: HTTP 200, 1.895.466 bytes, SHA-1 `32a7f7921a5f5c4ff99337ee6e75697e6c3e4ec1` bate; `plugin.json` do zip com `mdomingos-topoflow-panel` 1.4.0 |
| 2026-10-10 | **Submissão v1.4.0 enviada** em `grafana.com/orgs/mdomingos/plugins` | Status **Failed** na validação automática, minutos depois. A revisão fica bloqueada até corrigir. |
| 2026-10-10 | Relatório da validação | **Erros (bloqueiam):** (1) e (2) `osv-scanner-high-severity` por causa do `braces`, que a explicação no texto **não** evitou; (3) `scan-incomplete`, porque o Semgrep não leu `as const satisfies` em `src/model/types.ts:74`; (4) `code-rules-no-direct-css-imports` em `src/canvas/TopologyCanvas.tsx:58` (`import '@xyflow/react/dist/style.css'`). **Avisos:** link do LinkedIn (999) ×2, unsigned, `react-19-dep-jsxRuntimeImport` em `@xyflow/react` (o próprio relatório diz "may be a false positive"). |
| 2026-10-10 | Correções → **v1.4.1** | CSS do React Flow escopado (`:where(&)`); `types.ts` sem `satisfies`; Jest 30 e `eslint-webpack-plugin` removido (o `braces` sumiu do lockfile). Local: validador **0 erros**, Semgrep com as regras da Grafana **0 achados**, typecheck, 893 testes e build OK. Visual idêntico ao anterior, conferido por screenshot no modo de visualização e no de edição. |
| 2026-10-10 | Tag `v1.4.1` (`7251066`) enviada; release publicada pelo usuário na web; submissão atualizada | Download conferido: HTTP 200, 1.883.704 bytes, SHA-1 `3ae36cae4875ce22ef349fc9fdf1f63bb9ed6567` bate. |
| 2026-10-10 | Nova validação automática | **Passou**: só avisos (LinkedIn 999 ×2, unsigned, `react-19-dep-jsxRuntimeImport` em `@xyflow/react`) e nenhum erro. Status **"Aguardando análise"**: está na fila da revisão manual, que leva até 2 semanas. |
| 2026-10-10 | Diagnóstico do Actions pela API autenticada | Repositório OK: `enabled: true`, `allowed_actions: all`, os 5 YAML válidos. Mas o GitHub só registrou o `ci.yml` (às 23:37 UTC) e o `release.yml` dá 404. São 0 execuções, e o commit do master **não tem check suite do `github-actions`**: o Actions nem processa os pushes. (Hipótese de bloqueio na conta, **descartada** na linha seguinte.) |
| 2026-10-10 | **Causa real:** a aba Actions mostrava "Workflows aren't being run on this repository" com o botão **Enable Actions on this repository**. O usuário habilitou. | Os 5 workflows passaram a aparecer (Bundle Stats, CI, Create Plugin Update, Latest Grafana API compatibility check, Release). Esse interruptor fica fora de *Settings* e a API não o expõe. |
| 2026-10-11 | Primeiro CI da história do repositório (`66a6605`) | Build, lint e testes unitários OK. O e2e falhou nas 6 versões do Grafana (12.3.11 a nightly), 2 de 16 testes, desatualizados pelo layout da v1.4: a seção virou "Zabbix API", e o nome do host aparece também no rótulo da métrica. |
| 2026-10-11 | Testes e2e corrigidos (`a4abfef`, `abcc23f`) | **CI verde** nas 6 versões. Só os testes mudaram; o plugin enviado (1.4.1) é o mesmo. |
| 2026-11-06 | **Primeiro retorno da revisão manual** (v1.4.1) | **Obrigatório:** sanitizar o link do drill-down com `textUtil.sanitizeUrl` (`@grafana/data`) antes do `<a href>`, porque `javascript:...` passava, inclusive vindo de variável do dashboard (`src/canvas/drilldown.ts:29-36` e `:61-75`, `src/canvas/DrilldownSurface.tsx:63`). **Esclarecimento:** confirmar se o plugin é desenvolvido, oferecido ou suportado como parte dos serviços comerciais da JLCP; se for, a submissão deve ser **Commercial**. Os metadados citam JLCP, o ID antigo `jlcp-` e pedidos de cliente (`docs/prd-zabbix-direto.md`). **Recomendado:** (1) restringir a URL da Imagem a `https:` e `data:image/` e aplicar o limite do upload também no schema (`src/canvas/nodes/ImageNode.tsx:136`); (2) usar `theme.spacing`, `theme.typography` e `theme.shape` em vez de px fixos. Próximo passo: corrigir, responder e atualizar a submissão em grafana.com > My Plugins. |
| 2026-11-06 | Correções → **v1.4.2** | **Drill-down:** `textUtil.sanitizeUrl` sobre o endereço já interpolado. Caracteres de controle saem antes de completar o esquema, para que `java<tab>script:` seja bloqueado; o `https://` é completado antes do `sanitizeUrl`, que senão recusaria `datadog.corp:8443`. Endereço bloqueado deixa o elemento sem link, e o editor avisa. **Imagem:** só `https://` e `data:image/` (`src/model/imageSrc.ts`); a URL recusada fica salva, e o canvas mostra "URL não permitida". **Teto de 256 KB no schema** por `transform`, que zera só aquele `src`; um `refine` derrubaria a topologia inteira em `parseSection`. Upload de arquivo que não é imagem é recusado. **JLCP** removida do autor (`plugin.json`, `package.json`) e do copyright (`LICENSE`): o usuário confirmou que é projeto pessoal. **Px → tema:** não feito nesta versão (a justificativa vai na resposta). Local: typecheck, 931 testes, build, validador **0 erros** (avisos de sempre: LinkedIn 999, unsigned, `react-19-dep` do `@xyflow/react`). Semgrep não rodou (Docker parado); as regras da Grafana foram conferidas à mão contra o diff. Zip local SHA-1 `0f19184f518a834016ee1a0a6249d929c5cd5e91`; o da release do CI terá outro hash. |
| | Reenvio após a revisão manual | |
