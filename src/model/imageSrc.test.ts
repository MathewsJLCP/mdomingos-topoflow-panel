import {
  MAX_DATA_URI_LENGTH,
  MAX_IMAGE_BYTES,
  capImageSrc,
  cssImageUrl,
  imageSrcKind,
  isRenderableImageSrc,
} from './imageSrc';

/** Um data URI do tamanho exato de um arquivo de `bytes` bytes. */
const dataUri = (bytes: number) => `data:image/png;base64,${'A'.repeat(Math.ceil(bytes / 3) * 4)}`;

describe('imageSrcKind', () => {
  it('aceita https e upload de imagem', () => {
    expect(imageSrcKind('https://cdn.exemplo.com/logo.png')).toBe('https');
    expect(imageSrcKind('HTTPS://CDN.EXEMPLO.COM/logo.png')).toBe('https');
    expect(imageSrcKind('data:image/png;base64,iVBORw0KGgo=')).toBe('upload');
    expect(imageSrcKind('data:image/svg+xml;base64,PHN2Zz4=')).toBe('upload');
    expect(imageSrcKind('data:image/svg+xml,%3Csvg%3E')).toBe('upload');
  });

  it('vazio não é recusado: é só sem figura', () => {
    expect(imageSrcKind('')).toBe('empty');
    expect(imageSrcKind('   ')).toBe('empty');
  });

  it.each([
    'http://10.0.0.5/logo.png',
    '/public/img/logo.png',
    '//cdn.exemplo.com/logo.png',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'data:application/pdf;base64,JVBERi0=',
    'ftp://exemplo.com/logo.png',
  ])('recusa %j', (src) => {
    expect(imageSrcKind(src)).toBe('blocked');
    expect(isRenderableImageSrc(src)).toBe(false);
  });

  /**
   * O teto e o mesmo do editor, medido no data URI: o arquivo de 256 KB que o
   * editor aceita tem que passar aqui tambem, ou o schema apagaria um upload
   * que o proprio editor deixou entrar.
   */
  it('o upload no limite do editor passa; acima dele, não', () => {
    expect(imageSrcKind(dataUri(MAX_IMAGE_BYTES))).toBe('upload');
    expect(imageSrcKind(`data:image/png;base64,${'A'.repeat(MAX_DATA_URI_LENGTH)}`)).toBe('too-large');
  });
});

describe('capImageSrc', () => {
  it('zera só o upload acima do limite', () => {
    expect(capImageSrc(`data:image/png;base64,${'A'.repeat(MAX_DATA_URI_LENGTH)}`)).toBe('');
  });

  /**
   * URL recusada continua salva: quem configurou precisa ver o que estava la
   * para corrigir. Quem a impede de carregar e o canvas.
   */
  it('não toca em URL, chave da biblioteca nem upload dentro do limite', () => {
    for (const src of ['http://10.0.0.5/logo.png', 'topoflow/router', 'data:image/png;base64,AAA', '']) {
      expect(capImageSrc(src)).toBe(src);
    }
  });
});

describe('cssImageUrl', () => {
  it('envolve o endereço em url("...")', () => {
    expect(cssImageUrl('https://x/logo.png')).toBe('url("https://x/logo.png")');
  });

  /** Uma aspa encerraria a string CSS e o resto viraria outra declaração. */
  it('aspas e barra invertida não fecham a string CSS', () => {
    expect(cssImageUrl('https://x/a"); background: red; ("')).toBe('url("https://x/a%22); background: red; (%22")');
    expect(cssImageUrl('https://x/a\\b')).toBe('url("https://x/a%5Cb")');
  });

  it('descarta caractere de controle', () => {
    expect(cssImageUrl('https://x/\nlogo.png')).toBe('url("https://x/logo.png")');
  });
});
