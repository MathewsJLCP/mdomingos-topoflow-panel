/**
 * O que a figura da Imagem pode carregar.
 *
 * O `src` de uma Imagem guarda tres coisas: chave da biblioteca, data URI
 * (upload) e URL. A chave nunca passa por aqui, porque o desenho dela vem
 * embutido no plugin. As outras duas viram um `url(...)` que o **browser de
 * quem abre o dashboard** busca, e o endereco foi escrito por outra pessoa, a
 * que editou o painel. Entao a regra e uma lista curta do que se aceita, e nao
 * uma lista do que se recusa:
 *
 *   - **`https:`.** Endereco externo, com TLS.
 *   - **`data:image/...`.** O upload, que o editor gera com o `FileReader`.
 *
 * Fica de fora o `http:` (num Grafana servido em https o browser ja o bloqueia
 * como conteudo misto), o caminho relativo e qualquer outro esquema. A saida
 * para uma imagem num servidor sem TLS e baixar o arquivo e envia-lo.
 *
 * O dado salvo nao e alterado por esta regra: uma URL recusada continua no JSON,
 * o canvas mostra o aviso no lugar da figura e o editor explica o motivo. Assim
 * quem configurou ve o que estava la e corrige, em vez de encontrar o campo
 * vazio sem saber por que. A unica excecao e o upload grande demais
 * (`capImageSrc`).
 */

/**
 * Teto do arquivo enviado, antes de virar base64.
 *
 * 256 KB e generoso para icone e logo (um PNG de 128x128 costuma ter menos de
 * 20 KB) e ainda mantem o dashboard leve mesmo com uma duzia de imagens. O data
 * URI viaja dentro do JSON do dashboard, em toda leitura, inclusive para quem
 * nunca olha para esta imagem.
 */
export const MAX_IMAGE_BYTES = 256 * 1024;

/**
 * O mesmo teto, medido no data URI: base64 escreve 4 caracteres para cada 3
 * bytes, mais o cabecalho (`data:image/svg+xml;base64,`), com folga.
 */
export const MAX_DATA_URI_LENGTH = Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 128;

export type ImageSrcKind =
  /** Sem figura. */
  | 'empty'
  /** URL externa com TLS. */
  | 'https'
  /** Data URI de imagem, dentro do teto. */
  | 'upload'
  /** Data URI de imagem acima do teto. */
  | 'too-large'
  /** Qualquer outra coisa: `http:`, caminho relativo, outro esquema. */
  | 'blocked';

const HTTPS = /^https:\/\//i;
const DATA_IMAGE = /^data:image\/[a-z0-9.+-]+[;,]/i;

/** Classifica o `src`. A chave da biblioteca deve ser tratada antes, por quem chama. */
export function imageSrcKind(src: string): ImageSrcKind {
  const value = src.trim();
  if (!value) {
    return 'empty';
  }
  if (DATA_IMAGE.test(value)) {
    return value.length > MAX_DATA_URI_LENGTH ? 'too-large' : 'upload';
  }
  return HTTPS.test(value) ? 'https' : 'blocked';
}

/** O canvas e a miniatura do editor so carregam o que passa por aqui. */
export function isRenderableImageSrc(src: string): boolean {
  const kind = imageSrcKind(src);
  return kind === 'https' || kind === 'upload';
}

/**
 * O valor CSS `url("...")` do `src`.
 *
 * Aspas e barra invertida encerrariam a string CSS no meio. Elas viram o escape
 * de URL (`%22`, `%5C`), que significa a mesma coisa no endereco e no data URI.
 * Caractere de controle sai, como o browser faria.
 */
export function cssImageUrl(src: string): string {
  const escaped = src
    .trim()
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\\/g, '%5C')
    .replace(/"/g, '%22');
  return `url("${escaped}")`;
}

/**
 * O teto do upload, aplicado no schema e nao so no editor.
 *
 * Um dashboard importado ou editado no JSON pode trazer um data URI de
 * megabytes que o editor nunca deixaria entrar. Aqui ele vira `''`, e a Imagem
 * aparece sem figura.
 *
 * Isto **corrige o campo, e nao reprova o valor**, e a diferenca importa: um
 * campo que falha a validacao derruba a secao inteira em `parseSection`, e o
 * painel cairia na topologia padrao. Seria perder o mapa todo por causa de uma
 * imagem.
 */
export function capImageSrc(src: string): string {
  return imageSrcKind(src) === 'too-large' ? '' : src;
}
