import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { STARTER_ICON_REF } from '../icons';
import { addElement } from '../model/mutations';
import { sampleTopology } from '../model/sampleTopology';
import { TopoImage, Topology } from '../model/types';
import { ImageForm } from './ElementForms';

/**
 * O formulario da imagem na ordem em que ela se le: o arquivo, o que ela diz, e
 * so entao como ela acende. O bloco de estado vive **dentro** do modo Estado da
 * placa — fora dali nao haveria superficie que pudesse mudar de cor.
 */

const base = addElement(sampleTopology, 'image', { x: 0, y: 0 });
const [image] = base.images;

/**
 * O formulario e realimentado pelo que ele escreve, como no editor de verdade:
 * `onChange` sobe para o painel, o painel grava em `options` e a topologia nova
 * desce de volta como prop. Sem esse laco, um campo que reage ao proprio valor
 * salvo (o modo da Figura) seria testado num mundo em que a escrita nunca chega.
 */
function setup(overrides: Partial<TopoImage> = {}) {
  const element: TopoImage = { ...image, ...overrides };
  const onChange = jest.fn<void, [Topology]>();

  function Harness() {
    const [topology, setTopology] = React.useState<Topology>({ ...base, images: [element] });

    return (
      <ImageForm
        element={topology.images[0]}
        topology={topology}
        frames={[]}
        onChange={(next) => {
          onChange(next);
          setTopology(next);
        }}
      />
    );
  }

  render(<Harness />);

  return { onChange, result: () => onChange.mock.calls.at(-1)?.[0].images[0] };
}

const toggle = () => screen.getByRole('switch', { name: 'Background' });

/** A Imagem nova nasce na Biblioteca; o arquivo fica a um clique. */
const paraArquivo = () => fireEvent.click(screen.getByRole('radio', { name: 'Arquivo ou URL' }));

describe('ImageForm — arquivo e texto', () => {
  it('oferece envio e URL como caminhos para a mesma coisa', () => {
    setup();
    paraArquivo();

    expect(screen.getByLabelText('URL da imagem')).toBeInTheDocument();
  });

  it('a URL colada vira o `src` do elemento', () => {
    const { result } = setup();
    paraArquivo();

    fireEvent.change(screen.getByLabelText('URL da imagem'), { target: { value: 'https://x/logo.png' } });

    expect(result()?.src).toBe('https://x/logo.png');
  });

  it('URL https não traz aviso', () => {
    setup({ src: 'https://x/logo.png' });

    expect(screen.queryByText(/Só endereços https/)).not.toBeInTheDocument();
  });

  /**
   * O canvas nao carrega `http://`. O formulario diz isso e mostra a saida, em
   * vez de deixar o usuario concluir que a URL esta errada.
   */
  it('URL http avisa que só https é aceito e aponta o upload', () => {
    setup({ src: 'http://10.0.0.5/logo.png' });

    expect(screen.getByText(/Só endereços https:\/\/ são aceitos/)).toHaveTextContent('envie por aqui');
    // A miniatura tem `alt=""` (decorativa), entao nao tem papel `img` para o RTL.
    expect(document.querySelector('img[src^="http:"]')).toBeNull();
  });

  it('URL https mostra a miniatura', () => {
    setup({ src: 'https://x/logo.png' });

    expect(document.querySelector('img[src="https://x/logo.png"]')).not.toBeNull();
  });

  it('arquivo que não é imagem é recusado e o `src` não muda', () => {
    const { onChange } = setup({ src: 'https://x/logo.png' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [new File(['%PDF'], 'manual.pdf', { type: 'application/pdf' })] },
    });

    expect(screen.getByText('O arquivo não é uma imagem.')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  /** O data URI não volta para o campo: são dezenas de milhares de caracteres. */
  it('com arquivo enviado, o campo de URL fica vazio e explica', () => {
    setup({ src: 'data:image/png;base64,iVBORw0KGgo=' });

    const campo = screen.getByLabelText('URL da imagem');
    expect(campo).toHaveValue('');
    expect(campo).toHaveAttribute('placeholder', expect.stringContaining('Arquivo enviado'));
  });

  it('o texto aceita métrica, como o rótulo da conexão', () => {
    const { result } = setup();

    fireEvent.change(screen.getByLabelText('Texto'), { target: { value: 'IN: ${traffic in}' } });

    expect(result()?.text).toBe('IN: ${traffic in}');
  });

  /**
   * O `NumberField` rotula com um `<span>`, nao com `<label for>` — o campo se
   * alcanca pelo valor, que e unico neste formulario.
   */
  it('o tamanho da legenda é editável', () => {
    const { result } = setup({ fontSize: 12 });

    fireEvent.change(screen.getByDisplayValue('12'), { target: { value: '24' } });

    expect(result()?.fontSize).toBe(24);
  });

  it('apagar o texto apaga o campo — ausência é o desligado', () => {
    const { result } = setup({ text: 'algo' });

    fireEvent.change(screen.getByLabelText('Texto'), { target: { value: '' } });

    expect(result()?.text).toBeUndefined();
  });
});

/**
 * A biblioteca de icones chegou a Imagem. O `src` guarda as tres coisas — data
 * URI, URL e chave do catalogo — e e o proprio valor que diz qual delas e; nao
 * ha campo de modo no schema para discordar dele.
 */
describe('ImageForm — figura da biblioteca', () => {
  const modo = (nome: 'Biblioteca' | 'Arquivo ou URL') => screen.getByRole('radio', { name: nome });

  it('abre em Arquivo quando o `src` é um upload ou uma URL', () => {
    setup({ src: 'https://exemplo.com/logo.png' });

    expect(modo('Arquivo ou URL')).toBeChecked();
    expect(screen.getByLabelText('URL da imagem')).toBeInTheDocument();
  });

  it('a Imagem nova abre em Biblioteca, no Roteador', () => {
    setup();

    expect(modo('Biblioteca')).toBeChecked();
    expect(screen.getByLabelText('Ícone')).toHaveTextContent('Roteador');
  });

  it('sem figura nenhuma, abre em Biblioteca', () => {
    setup({ src: '' });

    expect(modo('Biblioteca')).toBeChecked();
  });

  it('abre em Biblioteca quando o `src` é uma chave do catálogo', () => {
    setup({ src: 'topoflow/router' });

    expect(modo('Biblioteca')).toBeChecked();
    expect(screen.getByLabelText('Ícone')).toHaveTextContent('Roteador');
  });

  it('escolher um ícone grava a chave no `src`', () => {
    const { result } = setup({ src: '' });

    fireEvent.click(modo('Biblioteca'));
    fireEvent.click(screen.getByLabelText('Ícone'));
    fireEvent.click(screen.getByRole('option', { name: 'Servidor' }));

    expect(result()?.src).toBe('padrao/servidor');
  });

  /**
   * Trocar de modo troca a figura na hora, sem esperar uma segunda escolha.
   *
   * Antes, o seletor so escrevia quando o usuario escolhia um icone — e ate la o
   * radio dizia "Biblioteca" com o canvas ainda exibindo o upload. Modo e desenho
   * discordando e exatamente o que a tela nao pode fazer.
   */
  it('trocar para Biblioteca já troca a figura pelo ícone inicial', () => {
    const { result } = setup({ src: 'data:image/png;base64,AAA' });

    fireEvent.click(modo('Biblioteca'));

    expect(result()?.src).toBe(STARTER_ICON_REF);
  });

  /**
   * A mesma garantia de alternar Metrica <-> Trigger: trocar de modo nao pode
   * custar o que ja estava configurado. O upload fica guardado e volta inteiro.
   */
  it('ir e voltar entre os modos não descarta o upload', () => {
    const { result } = setup({ src: 'data:image/png;base64,AAA' });

    fireEvent.click(modo('Biblioteca'));
    fireEvent.click(modo('Arquivo ou URL'));

    expect(result()?.src).toBe('data:image/png;base64,AAA');
  });

  it('em Arquivo não há campo de cor — não há variante a escolher', () => {
    setup({ src: 'https://exemplo.com/logo.png' });

    expect(screen.queryByText('Cor do ícone')).not.toBeInTheDocument();
  });
});

describe('ImageForm — background', () => {
  it('nasce desligado, como pedido', () => {
    setup();

    expect(toggle()).not.toBeChecked();
    expect(screen.queryByRole('radio', { name: 'Sólido' })).not.toBeInTheDocument();
  });

  /** O fundo do mockup: pela cor do estado, a 22%. */
  it('ligar cria o fundo pela cor do estado', () => {
    const { result } = setup();

    fireEvent.click(toggle());

    expect(result()?.background).toEqual({ mode: 'state', color: '', opacity: 0.22 });
  });

  it('desligar apaga o objeto inteiro', () => {
    const { result } = setup({ background: { mode: 'state', color: '', opacity: 0.22 } });

    fireEvent.click(toggle());

    expect(result()?.background).toBeUndefined();
  });

  /** O estado vale sempre na imagem: pinta o ícone e o círculo, com ou sem fundo. */
  it('o bloco de estado está sempre na tela', () => {
    setup();

    expect(screen.getByRole('radio', { name: 'Métrica' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Trigger' })).toBeInTheDocument();
    expect(screen.getByText('Thresholds')).toBeInTheDocument();
  });

  /** O fundo sólido de antes da v1.4 continua ajustável, e pode passar a seguir o estado. */
  it('fundo sólido salvo pode passar a seguir o estado, mantendo a cor', () => {
    const { result } = setup({ background: { mode: 'fixed', color: 'blue', opacity: 1 } });

    fireEvent.click(screen.getByRole('button', { name: 'Usar a cor do estado' }));

    expect(result()?.background).toEqual({ mode: 'state', color: 'blue', opacity: 1 });
  });

  it('a escolha de estado grava na imagem, não em outro elemento', () => {
    const { result } = setup({ background: { mode: 'state', color: 'blue', opacity: 1 } });

    fireEvent.click(screen.getByRole('radio', { name: 'Trigger' }));

    expect(result()?.trigger?.enabled).toBe(true);
  });
});
