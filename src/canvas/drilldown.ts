import { locationUtil, textUtil } from '@grafana/data';
import { getTemplateSrv, locationService } from '@grafana/runtime';

import { Drilldown } from '../model/types';

/**
 * Drill-down: para onde o clique no elemento leva.
 *
 * O gesto e o mesmo de qualquer link da web, e o elemento vira de fato um `<a>`
 * (ver `DrilldownSurface`) — nao um `div` com `onClick`. A diferenca aparece na
 * mao do operador: ctrl+clique e clique do meio abrem noutra aba, o endereco
 * aparece na barra de status antes do clique, o Tab alcanca o elemento e o
 * leitor de tela o anuncia como link. Nada disso se obtem interceptando cliques.
 *
 * Este modulo responde as duas perguntas que o `<a>` sozinho nao responde:
 * **qual endereco** (as variaveis do dashboard so tem valor agora) e **como
 * navegar** (dentro do Grafana, sem recarregar a pagina).
 */

/**
 * O endereco final: o que o usuario digitou, com as variaveis do dashboard
 * resolvidas. `undefined` quando nao ha para onde ir — e o que apaga o link em
 * vez de renderizar um `<a href="">`, que recarrega a pagina atual.
 *
 * A interpolacao acontece **aqui e nao no que fica salvo**: `$host` vale o que
 * vale no instante do clique, e resolve-lo na hora de gravar congelaria o host
 * que estava selecionado quando o painel foi configurado.
 *
 * A sanitizacao vem **por ultimo**, sobre o endereco ja interpolado: e ali que
 * uma variavel `$link` valendo `javascript:...` vira de fato o `href`. Ver
 * `isBlockedDrilldown`.
 *
 * A ordem das outras duas etapas tambem e de seguranca:
 *
 *   - **caracteres de controle saem antes do `withScheme`.** O browser ignora
 *     tab e quebra de linha dentro de uma URL, entao `java<tab>script:` executa
 *     como `javascript:`. Sem limpar antes, o `withScheme` nao reconheceria o
 *     esquema e devolveria `https://java<tab>script:...` — inofensivo, mas um
 *     link sem sentido em vez de link nenhum.
 *   - **o `withScheme` vem antes do `sanitizeUrl`.** O `sanitizeUrl` le como
 *     esquema tudo ate o ultimo `:`, e recusaria `datadog.corp:8443/painel` por
 *     comecar com `data`. Com o `https://` ja no lugar, o esquema lido e `https`.
 */
export function drilldownHref(drilldown: Drilldown | undefined): string | undefined {
  const raw = drilldown?.url.trim();
  if (!raw) {
    return undefined;
  }

  const safe = textUtil.sanitizeUrl(withScheme(stripControlChars(interpolate(raw))));
  return safe === BLOCKED_URL ? undefined : safe;
}

/** O que o browser descarta de uma URL antes de interpreta-la. */
function stripControlChars(url: string): string {
  return url.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
}

/**
 * O que o `sanitizeUrl` do Grafana devolve no lugar de um endereco perigoso
 * (`javascript:`, `data:`, `vbscript:`, inclusive disfarcados com maiuscula,
 * tab ou entidade HTML).
 *
 * Um `<a href="about:blank">` levaria o operador a uma pagina em branco no
 * clique, sem dizer por que. Sem `href` o elemento volta a ser um `div`: o
 * clique nao faz nada, e o editor explica o motivo (ver `isBlockedDrilldown`).
 */
const BLOCKED_URL = 'about:blank';

/**
 * Ha um link configurado, mas o endereco foi recusado pela sanitizacao.
 *
 * Existe para o editor distinguir "sem link" de "link bloqueado": sem isso, quem
 * digitou `javascript:...` veria "Sem link." e concluiria que o campo nao salvou.
 */
export function isBlockedDrilldown(drilldown: Drilldown | undefined): boolean {
  return hasDrilldown(drilldown) && drilldownHref(drilldown) === undefined;
}

/**
 * Completa o esquema de um endereco externo escrito sem ele.
 *
 * `www.google.com` num `href` **nao** e um endereco: e um caminho relativo, e o
 * browser o resolve contra a pagina atual. Num dashboard isso da
 * `/d/uid/www.google.com`, e o operador cai num 404 do Grafana em vez de sair
 * para a outra plataforma — o defeito que este campo tinha, e que so aparecia
 * fora do caso dashboard-para-dashboard.
 *
 * Adivinhar um esquema e assumir alguma coisa, entao vale dizer o que se assume
 * e por que:
 *
 *   - **`https`**, e nao `http`: e o default da web hoje, e o erro que ele
 *     produz e visivel e corrigivel (a pagina nao carrega, o usuario escreve
 *     `http://`). O contrario — assumir `http` — mandaria credencial em claro
 *     para um servico que talvez tenha TLS, que e o erro que nao se ve.
 *   - **so quando falta o esquema e o endereco nao e interno.** Caminho que
 *     comeca com `/` continua interno, e quem escreveu `http://` ou `mailto:`
 *     recebe de volta exatamente o que escreveu.
 *
 * O editor mostra o endereco ja completado, entao a suposicao nao e silenciosa:
 * quem precisa de `http://` ve `https://` na tela e corrige antes de salvar.
 */
export function withScheme(url: string): string {
  return isInternal(url) || hasScheme(url) ? url : `https://${url}`;
}

/**
 * O endereco ja declara o proprio protocolo.
 *
 * O `(?!\d)` e o que separa esquema de porta: sem ele, `10.0.0.5:8080/zabbix`
 * passaria por um endereco com esquema `10.0.0.5` — e um servico interno em
 * `IP:porta`, que e metade das ferramentas de um NOC, continuaria quebrado
 * depois da correcao acima.
 */
export function hasScheme(url: string): boolean {
  return /^[a-z][a-z0-9+\-.]*:(?!\d)/i.test(url);
}

/**
 * `getTemplateSrv()` devolve o singleton que o Grafana instala no boot — e
 * `undefined` fora dele (jest, storybook), embora o tipo prometa o contrario.
 * Sem dashboard nao ha variavel para resolver, e o texto cru ja e a resposta
 * certa; o que nao pode acontecer e o painel cair por causa de um link.
 */
function interpolate(url: string): string {
  try {
    return getTemplateSrv()?.replace(url) ?? url;
  } catch {
    return url;
  }
}

/**
 * O elemento tem drill-down configurado.
 *
 * Distinto de `drilldownHref`: aqui nao ha interpolacao nem tema, e a pergunta e
 * outra — nao "para onde vou" e sim "o clique deste elemento ja tem dono". Quem
 * precisa disso e o painel de triggers, que desiste do pin quando o clique leva
 * embora (ver `ElementHover`).
 */
export function hasDrilldown(drilldown: Drilldown | undefined): boolean {
  return Boolean(drilldown?.url.trim());
}

/**
 * O que fazer com o clique.
 *
 * Devolve `true` quando **nos** navegamos (e o chamador deve chamar
 * `preventDefault`), e `false` quando o browser e quem deve seguir o `href`.
 *
 * Tres casos deixam o browser trabalhar, e nenhum deles e descuido:
 *
 *   - **ctrl/cmd/shift/alt, ou botao que nao e o principal.** Sao gestos de
 *     "abrir noutro lugar". Intercepta-los devolveria ao operador uma navegacao
 *     na aba atual quando ele pediu explicitamente uma aba nova — o defeito
 *     classico de quem troca um `<a>` por um `onClick`.
 *   - **`targetBlank`.** O proprio `target="_blank"` ja resolve.
 *   - **endereco externo.** `locationService` so sabe navegar dentro do
 *     Grafana; um `https://` de fora precisa do browser.
 *
 * O caso interno e o que ganha alguma coisa: `locationService.push` troca de
 * dashboard sem recarregar a aplicacao inteira, que e a diferenca entre um
 * drill-down instantaneo e cinco segundos de tela branca num telao.
 */
export function shouldNavigateInApp(url: string, targetBlank: boolean, event: DrilldownClick): boolean {
  if (targetBlank || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) {
    return false;
  }

  return isInternal(url);
}

/** So o que o `shouldNavigateInApp` le — testavel sem um evento de DOM inteiro. */
export interface DrilldownClick {
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  /** 0 e o botao principal; o do meio (1) abre em aba nova por conta do browser. */
  button: number;
}

/**
 * Endereco que vive dentro deste Grafana.
 *
 * `//outro.host` e externo apesar da barra inicial — e um protocol-relative URL,
 * e trata-lo como caminho interno mandaria o operador para um lugar que nao
 * existe. Qualquer coisa com esquema (`https:`, `mailto:`) tambem sai daqui.
 */
export function isInternal(url: string): boolean {
  return url.startsWith('/') && !url.startsWith('//');
}

/**
 * Navega dentro do Grafana.
 *
 * `stripBaseFromUrl` e obrigatorio, nao higiene: numa instalacao servida em
 * subcaminho (`root_url = https://x/grafana`) o usuario copia da barra de
 * enderecos `/grafana/d/uid/...`, e o `locationService` trabalha em caminhos
 * **relativos a raiz do app**. Sem tirar o prefixo, o clique levaria a
 * `/grafana/grafana/d/uid/...`.
 */
export function navigateInApp(url: string): void {
  locationService.push(locationUtil.stripBaseFromUrl(url));
}
