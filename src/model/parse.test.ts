import { defaultCanvas, defaultTopology } from './defaults';
import { MAX_DATA_URI_LENGTH } from './imageSrc';
import { parseTopoFlowOptions } from './parse';
import { sampleTopology } from './sampleTopology';

describe('parseTopoFlowOptions', () => {
  it('aceita opcoes validas sem reclamar', () => {
    const { options, issues } = parseTopoFlowOptions({
      schemaVersion: 1,
      topology: sampleTopology,
      canvas: { showGrid: false, snapToGrid: false, gridSize: 8 },
    });

    expect(issues).toEqual([]);
    expect(options.canvas.gridSize).toBe(8);
    expect(options.topology.nodes).toHaveLength(3);
  });

  it('usa os defaults em silencio quando as secoes estao ausentes', () => {
    // Estado de um painel recem-adicionado ao dashboard: canvas em branco.
    const { options, issues } = parseTopoFlowOptions({});

    expect(issues).toEqual([]);
    expect(options.topology).toEqual(defaultTopology);
    expect(options.topology.nodes).toEqual([]);
    expect(options.canvas).toEqual(defaultCanvas);
  });

  it('aceita options nao-objeto sem explodir', () => {
    expect(parseTopoFlowOptions(undefined).options.topology).toEqual(defaultTopology);
    expect(parseTopoFlowOptions(null).options.topology).toEqual(defaultTopology);
    expect(parseTopoFlowOptions('lixo').options.topology).toEqual(defaultTopology);
  });

  /**
   * A flag existe para que o painel se **cale** em vez de escrever: com a
   * topologia invalida ele desenha o canvas vazio, e um arraste sem querer
   * gravaria esse vazio por cima do desenho do usuario.
   */
  it('marca a topologia como invalida so quando havia valor salvo e ele nao validou', () => {
    expect(parseTopoFlowOptions({}).topologyInvalid).toBe(false);
    expect(parseTopoFlowOptions({ topology: sampleTopology }).topologyInvalid).toBe(false);
    expect(parseTopoFlowOptions({ topology: { nodes: 'nao é uma lista' } }).topologyInvalid).toBe(true);
  });

  /** Erro de canvas nao pode trancar a edicao da topologia, que esta intacta. */
  it('nao marca a topologia por causa de um canvas corrompido', () => {
    const { issues, topologyInvalid } = parseTopoFlowOptions({
      topology: sampleTopology,
      canvas: { gridSize: 'grande' },
    });

    expect(issues).toHaveLength(1);
    expect(topologyInvalid).toBe(false);
  });

  it('reporta e isola uma secao corrompida sem derrubar a outra', () => {
    const { options, issues } = parseTopoFlowOptions({
      topology: { nodes: 'nao é uma lista', edges: [] },
      canvas: { showGrid: false, snapToGrid: false, gridSize: 8 },
    });

    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('topology');
    expect(options.topology).toEqual(defaultTopology);
    // A preferencia de canvas do usuario sobrevive ao erro na topologia.
    expect(options.canvas.gridSize).toBe(8);
  });

  it('descarta arestas penduradas em vez de rejeitar a topologia inteira', () => {
    const [node] = sampleTopology.nodes;
    const { options, issues } = parseTopoFlowOptions({
      topology: {
        nodes: [node],
        edges: [
          { ...sampleTopology.edges[0], target: 'no-que-nao-existe' },
          { ...sampleTopology.edges[1], source: node.id, target: node.id },
        ],
      },
    });

    expect(issues).toEqual([]);
    expect(options.topology.nodes).toHaveLength(1);
    expect(options.topology.edges).toHaveLength(1);
    expect(options.topology.edges[0].id).toBe(sampleTopology.edges[1].id);
  });

  it('descarta ids duplicados de no e de aresta', () => {
    const [node] = sampleTopology.nodes;
    const { options } = parseTopoFlowOptions({
      topology: {
        nodes: [node, { ...node, position: { x: 999, y: 999 } }],
        edges: [],
      },
    });

    expect(options.topology.nodes).toHaveLength(1);
    expect(options.topology.nodes[0].position).toEqual(node.position);
  });

  it('carimba a versao corrente do schema', () => {
    const { options } = parseTopoFlowOptions({ schemaVersion: 99 });
    expect(options.schemaVersion).toBe(1);
  });
});

/**
 * Decisão D6: thresholds por elemento entraram como campo opcional, então uma
 * topologia salva antes deles carrega e continua sendo pintada pelo field.
 */
describe('parseTopoFlowOptions — thresholds do elemento', () => {
  const [node] = sampleTopology.nodes;

  it('nó salvo antes da feature carrega sem regra própria', () => {
    const { options, issues } = parseTopoFlowOptions({ topology: { nodes: [node], edges: [] } });

    expect(issues).toEqual([]);
    expect(options.topology.nodes[0].thresholds).toBeUndefined();
  });

  it('preserva as regras salvas', () => {
    const thresholds = { steps: [{ type: 'threshold', value: 90, color: 'red', label: 'crítico' }] };
    const { options, issues } = parseTopoFlowOptions({
      topology: { nodes: [{ ...node, thresholds }], edges: [] },
    });

    expect(issues).toEqual([]);
    expect(options.topology.nodes[0].thresholds).toEqual(thresholds);
  });

  /**
   * Regras salvas antes dos tipos novos não têm `type` e são todas threshold.
   * É o `z.preprocess` de `elementRuleSchema` que as resgata — um `.default()`
   * no discriminador não funcionaria, pelo mesmo motivo já documentado no
   * binding de trigger.
   */
  it('regra salva sem `type` carrega como threshold', () => {
    const { options, issues } = parseTopoFlowOptions({
      topology: {
        nodes: [{ ...node, thresholds: { steps: [{ value: 80, color: 'red', label: 'alto' }] } }],
        edges: [],
      },
    });

    expect(issues).toEqual([]);
    expect(options.topology.nodes[0].thresholds?.steps).toEqual([
      { type: 'threshold', value: 80, color: 'red', label: 'alto' },
    ]);
  });

  it('aceita os tipos vindos do Value mappings', () => {
    const steps = [
      { type: 'value', match: '200', color: 'green', label: 'UP' },
      { type: 'range', from: 1, to: 5, color: 'blue' },
      { type: 'regex', pattern: '^ERR', color: 'red' },
      { type: 'special', match: 'null', color: 'orange' },
    ];
    const { options, issues } = parseTopoFlowOptions({
      topology: { nodes: [{ ...node, thresholds: { steps } }], edges: [] },
    });

    expect(issues).toEqual([]);
    expect(options.topology.nodes[0].thresholds?.steps).toEqual(steps);
  });

  it('objeto sem `steps` vira lista vazia — que é o mesmo que não ter regra', () => {
    const { options } = parseTopoFlowOptions({
      topology: { nodes: [{ ...node, thresholds: {} }], edges: [] },
    });

    expect(options.topology.nodes[0].thresholds).toEqual({ steps: [] });
  });
});

/**
 * Bloco 3: `thresholds` chegou a arestas e points. O campo entrou `.optional()`,
 * entao `SCHEMA_VERSION` continua em 1 e nao existe migrador — o que estes casos
 * fixam e que essa aposta se sustenta nos dois sentidos: o que estava salvo
 * carrega intacto, e o que se salva agora sobrevive ao round-trip.
 */
describe('parseTopoFlowOptions — thresholds em aresta e point', () => {
  // As duas pontas, e nao so a origem: uma aresta sem os dois nos e descartada
  // pela integridade referencial da topologia, e o teste passaria a medir isso.
  const nodes = sampleTopology.nodes;
  const [edge] = sampleTopology.edges;
  const point = { id: 'ponto', position: { x: 0, y: 0 }, color: { fixed: 'blue' }, zIndex: 0 };

  it('aresta salva só com `color` carrega sem regra própria e sem perder a cor', () => {
    const salva = { ...edge, color: { fixed: 'purple' } };
    const { options, issues } = parseTopoFlowOptions({ topology: { nodes, edges: [salva] } });

    expect(issues).toEqual([]);
    // Sem regra propria o elemento nao exibe estado por metrica, e
    // `color.fixed` continua sendo o nivel 2 — a Base.
    expect(options.topology.edges[0].thresholds).toBeUndefined();
    expect(options.topology.edges[0].color).toEqual({ fixed: 'purple' });
  });

  it('point salvo só com `color` carrega sem regra própria e sem perder a cor', () => {
    const { options, issues } = parseTopoFlowOptions({
      topology: { nodes: [], edges: [], points: [point] },
    });

    expect(issues).toEqual([]);
    expect(options.topology.points[0].thresholds).toBeUndefined();
    expect(options.topology.points[0].color).toEqual({ fixed: 'blue' });
  });

  it('preserva as regras de uma aresta', () => {
    const thresholds = { steps: [{ type: 'threshold', value: 1, color: 'red', label: 'down' }] };
    const { options, issues } = parseTopoFlowOptions({
      topology: { nodes, edges: [{ ...edge, thresholds }] },
    });

    expect(issues).toEqual([]);
    expect(options.topology.edges[0].thresholds).toEqual(thresholds);
  });

  it('preserva as regras de um point', () => {
    const thresholds = { steps: [{ type: 'special', match: 'null', color: 'orange' }] };
    const { options, issues } = parseTopoFlowOptions({
      topology: { nodes: [], edges: [], points: [{ ...point, thresholds }] },
    });

    expect(issues).toEqual([]);
    expect(options.topology.points[0].thresholds).toEqual(thresholds);
  });
});

/**
 * Bloco 6: o Texto perdeu a fonte de estado e ganhou background.
 *
 * A remoção do `trigger` não precisa de migrador porque o Zod descarta chave
 * desconhecida por padrão e nenhum schema daqui é `.strict()` — o texto salvo
 * carrega, e a chave só some do JSON no primeiro save seguinte.
 */
describe('parseTopoFlowOptions — texto', () => {
  const [text] = sampleTopology.texts;
  const carrega = (raw: object) => parseTopoFlowOptions({ topology: { nodes: [], edges: [], texts: [raw] } });

  it('texto salvo com `trigger` carrega sem erro, e a chave é descartada', () => {
    const { options, issues } = carrega({ ...text, trigger: { enabled: true, host: 'AGLIN-FW-STARTI' } });

    expect(issues).toEqual([]);
    expect(options.topology.texts[0]).not.toHaveProperty('trigger');
    // O resto do texto atravessa intacto — é só o estado que saiu.
    expect(options.topology.texts[0].content).toEqual(text.content);
    expect(options.topology.texts[0].fontSize).toBe(text.fontSize);
  });

  it('texto salvo com `color.field` carrega — o campo fica no JSON, apenas inerte', () => {
    const { options, issues } = carrega({ ...text, color: { fixed: 'red', field: 'cpu_usage' } });

    expect(issues).toEqual([]);
    expect(options.topology.texts[0].color).toEqual({ fixed: 'red', field: 'cpu_usage' });
  });

  it('texto salvo antes do background carrega sem placa', () => {
    const { options, issues } = carrega(text);

    expect(issues).toEqual([]);
    expect(options.topology.texts[0].background).toBeUndefined();
  });

  it('preserva a placa salva', () => {
    const background = { color: 'blue', opacity: 0.3 };
    const { options, issues } = carrega({ ...text, background });

    expect(issues).toEqual([]);
    expect(options.topology.texts[0].background).toEqual(background);
  });

  it('rejeita opacidade fora da faixa em vez de gravar valor impossível', () => {
    const { issues } = carrega({ ...text, background: { color: 'blue', opacity: 4 } });

    expect(issues).toHaveLength(1);
  });
});

/** Campos novos do postit: ambos `.default`, então nada de migrador. */
/** Bloco B: `alert` entrou opcional nos três elementos que têm trigger. */
describe('parseTopoFlowOptions — animação de alerta', () => {
  const [node] = sampleTopology.nodes;
  const carrega = (alert: object) => parseTopoFlowOptions({ topology: { nodes: [{ ...node, alert }], edges: [] } });

  it('elemento salvo antes da feature carrega parado', () => {
    const { options, issues } = parseTopoFlowOptions({ topology: { nodes: [node], edges: [] } });

    expect(issues).toEqual([]);
    expect(options.topology.nodes[0].alert).toBeUndefined();
  });

  it('preserva a animação salva', () => {
    const alert = { animation: 'radar', fromSeverity: 4 };
    const { options, issues } = carrega(alert);

    expect(issues).toEqual([]);
    expect(options.topology.nodes[0].alert).toEqual(alert);
  });

  /** Sem `fromSeverity`, anima qualquer alarme — é o default de quem só quer ver mexer. */
  it('sem `fromSeverity`, assume qualquer severidade', () => {
    const { options, issues } = carrega({ animation: 'pulse' });

    expect(issues).toEqual([]);
    expect(options.topology.nodes[0].alert?.fromSeverity).toBe(0);
  });

  it('rejeita animação desconhecida em vez de aceitar valor livre', () => {
    expect(carrega({ animation: 'girar' }).issues).toHaveLength(1);
  });

  /** No eixo de métrica a animação é campo da regra, não do elemento. */
  it('preserva a animação por regra', () => {
    const steps = [{ type: 'threshold', value: 90, color: 'red', animation: 'radar' }];
    const { options, issues } = parseTopoFlowOptions({
      topology: { nodes: [{ ...node, thresholds: { steps } }], edges: [] },
    });

    expect(issues).toEqual([]);
    expect(options.topology.nodes[0].thresholds?.steps).toEqual(steps);
  });

  it('regra sem animação carrega parada', () => {
    const steps = [{ type: 'threshold', value: 90, color: 'red' }];
    const { options } = parseTopoFlowOptions({
      topology: { nodes: [{ ...node, thresholds: { steps } }], edges: [] },
    });

    expect(options.topology.nodes[0].thresholds?.steps[0]).not.toHaveProperty('animation');
  });
});

/** Bloco A: o tipo `severity` entrou na união de regras, de forma aditiva. */
describe('parseTopoFlowOptions — regra de severidade', () => {
  const [node] = sampleTopology.nodes;
  const carrega = (steps: object[]) =>
    parseTopoFlowOptions({ topology: { nodes: [{ ...node, thresholds: { steps } }], edges: [] } });

  it('preserva a regra salva', () => {
    const steps = [{ type: 'severity', atLeast: 4, color: 'purple', label: 'CAIU' }];
    const { options, issues } = carrega(steps);

    expect(issues).toEqual([]);
    expect(options.topology.nodes[0].thresholds?.steps).toEqual(steps);
  });

  /** Alternar Métrica ↔ Trigger nunca descartou configuração; nem aqui. */
  it('os dois eixos convivem na mesma lista', () => {
    const steps = [
      { type: 'threshold', value: 90, color: 'red' },
      { type: 'severity', atLeast: 2, color: 'yellow' },
    ];
    const { options, issues } = carrega(steps);

    expect(issues).toEqual([]);
    expect(options.topology.nodes[0].thresholds?.steps).toHaveLength(2);
  });

  it('rejeita severidade fora de 0..5', () => {
    expect(carrega([{ type: 'severity', atLeast: 9, color: 'red' }]).issues).toHaveLength(1);
  });
});

describe('parseTopoFlowOptions — postit', () => {
  const [postit] = sampleTopology.postits;

  const carrega = (raw: object) => parseTopoFlowOptions({ topology: { nodes: [], edges: [], postits: [raw] } });

  it('postit salvo antes dos campos novos assume o canto e a espessura padrão', () => {
    const { titlePosition, borderWidth, ...salvo } = postit;
    const { options, issues } = carrega(salvo);

    expect(issues).toEqual([]);
    // O título sempre viveu no canto superior esquerdo: o default preserva isso.
    expect(options.topology.postits[0].titlePosition).toBe('top-left');
    expect(options.topology.postits[0].borderWidth).toBe(2);
  });

  it('preserva o canto e a espessura escolhidos', () => {
    const { options, issues } = carrega({ ...postit, titlePosition: 'bottom-right', borderWidth: 4 });

    expect(issues).toEqual([]);
    expect(options.topology.postits[0].titlePosition).toBe('bottom-right');
    expect(options.topology.postits[0].borderWidth).toBe(4);
  });

  it('rejeita canto desconhecido em vez de aceitar valor livre', () => {
    const { issues } = carrega({ ...postit, titlePosition: 'meio' });

    expect(issues).toHaveLength(1);
  });
});

/**
 * A imagem chegou depois de tudo, e o teste que importa e o de ausencia:
 * dashboard salvo antes dela nao tem `images`, e nao pode cair para os defaults
 * por causa disso. E o mesmo contrato que permitiu manter `schemaVersion: 1` ao
 * longo de todos os tipos novos.
 */
describe('parseTopoFlowOptions — imagem', () => {
  const image = {
    id: 'image-1',
    position: { x: 10, y: 20 },
    size: { width: 96, height: 96 },
    src: 'data:image/png;base64,iVBORw0KGgo=',
    color: {},
    zIndex: 0,
  };

  const carrega = (raw: object) => parseTopoFlowOptions({ topology: { nodes: [], edges: [], images: [raw] } });

  it('topologia salva antes da imagem carrega intacta, com a lista vazia', () => {
    const { options, issues } = parseTopoFlowOptions({
      topology: { nodes: sampleTopology.nodes, edges: [], postits: [], texts: [] },
    });

    expect(issues).toEqual([]);
    expect(options.topology.images).toEqual([]);
    expect(options.topology.nodes).toHaveLength(sampleTopology.nodes.length);
  });

  it('imagem sem `fit` assume o ajuste que preserva a proporção', () => {
    const { options, issues } = carrega(image);

    expect(issues).toEqual([]);
    expect(options.topology.images[0].fit).toBe('contain');
  });

  /** Campo novo, dashboard antigo: o default é o tamanho com que ela já aparecia. */
  it('imagem sem `fontSize` assume o tamanho de legenda padrão', () => {
    const { options, issues } = carrega(image);

    expect(issues).toEqual([]);
    expect(options.topology.images[0].fontSize).toBe(12);
  });

  it('rejeita tamanho de fonte fora da faixa', () => {
    expect(carrega({ ...image, fontSize: 200 }).issues).toHaveLength(1);
  });

  it('preserva arquivo, texto e fundo salvos', () => {
    const { options, issues } = carrega({
      ...image,
      text: 'IN: ${traffic in}',
      background: { mode: 'state', color: 'blue', opacity: 0.5 },
    });

    expect(issues).toEqual([]);
    expect(options.topology.images[0]).toMatchObject({
      src: image.src,
      text: 'IN: ${traffic in}',
      background: { mode: 'state', color: 'blue', opacity: 0.5 },
    });
  });

  /**
   * O teto do upload vale no schema, mas como correcao do campo: um `refine`
   * reprovaria a secao inteira, e o painel cairia na topologia padrao.
   */
  it('upload acima do limite perde só a figura; o resto do mapa fica', () => {
    const grande = { ...image, id: 'image-2', src: `data:image/png;base64,${'A'.repeat(MAX_DATA_URI_LENGTH)}` };
    const { options, issues } = parseTopoFlowOptions({
      topology: { nodes: sampleTopology.nodes, edges: [], images: [image, grande] },
    });

    expect(issues).toEqual([]);
    expect(options.topology.nodes).toHaveLength(sampleTopology.nodes.length);
    expect(options.topology.images.map((i) => i.src)).toEqual([image.src, '']);
  });

  /** A URL recusada continua salva, para quem configurou ver e corrigir. */
  it('preserva a URL http salva, que o canvas não carrega', () => {
    const { options, issues } = carrega({ ...image, src: 'http://10.0.0.5/logo.png' });

    expect(issues).toEqual([]);
    expect(options.topology.images[0].src).toBe('http://10.0.0.5/logo.png');
  });

  it('rejeita modo de fundo desconhecido em vez de aceitar valor livre', () => {
    const { issues } = carrega({ ...image, background: { mode: 'gradiente', color: 'blue', opacity: 1 } });

    expect(issues).toHaveLength(1);
  });

  /** O pedido do cliente: a conexão vale para a imagem. */
  it('mantém a aresta que liga um nó a uma imagem', () => {
    const [node] = sampleTopology.nodes;
    const { options, issues } = parseTopoFlowOptions({
      topology: {
        nodes: [node],
        images: [image],
        edges: [
          {
            id: 'e1',
            source: node.id,
            target: image.id,
            style: 'solid',
            shape: 'straight',
            color: {},
            width: 2,
          },
        ],
      },
    });

    expect(issues).toEqual([]);
    expect(options.topology.edges).toHaveLength(1);
  });
});

describe('parseTopoFlowOptions — ícone do nó', () => {
  /** Ate o Bloco 3 exibir o icone era o unico comportamento possivel. */
  it('nó salvo antes do toggle continua exibindo o ícone', () => {
    const [node] = sampleTopology.nodes;
    const { showIcon, ...semFlag } = node.presentation;
    const { options, issues } = parseTopoFlowOptions({
      topology: { nodes: [{ ...node, presentation: semFlag }], edges: [] },
    });

    expect(issues).toEqual([]);
    expect(options.topology.nodes[0].presentation.showIcon).toBe(true);
  });

  it('respeita o toggle desligado', () => {
    const [node] = sampleTopology.nodes;
    const { options } = parseTopoFlowOptions({
      topology: { nodes: [{ ...node, presentation: { ...node.presentation, showIcon: false } }], edges: [] },
    });

    expect(options.topology.nodes[0].presentation.showIcon).toBe(false);
  });

  /**
   * A chave e string livre no schema: um icone que deixe de existir nao pode
   * invalidar a topologia inteira. Quem resolve o fallback e `resolveTopoIcon`.
   */
  it('aceita chave de ícone desconhecida sem reclamar', () => {
    const [node] = sampleTopology.nodes;
    const { options, issues } = parseTopoFlowOptions({
      topology: { nodes: [{ ...node, presentation: { ...node.presentation, icon: 'sitemap' } }], edges: [] },
    });

    expect(issues).toEqual([]);
    expect(options.topology.nodes[0].presentation.icon).toBe('sitemap');
  });
});

/**
 * O binding de trigger entrou como campo opcional justamente para nao precisar
 * de migrador. Estes testes sao o que prova isso — se um dia alguem trocar por
 * um `discriminatedUnion`, e aqui que a topologia salva quebra.
 */
describe('parseTopoFlowOptions — binding de trigger', () => {
  it('carrega topologia salva antes da feature sem tocar em nada', () => {
    const { options, issues } = parseTopoFlowOptions({ topology: sampleTopology });

    expect(issues).toEqual([]);
    expect(options.topology).toEqual(sampleTopology);
    expect(options.topology.nodes[0]).not.toHaveProperty('trigger');
  });

  it('aceita o vinculo e assume `enabled: false` quando a flag falta', () => {
    const [node] = sampleTopology.nodes;
    const { options, issues } = parseTopoFlowOptions({
      topology: { nodes: [{ ...node, trigger: { host: 'AGLIN-FW-STARTI' } }], edges: [] },
    });

    expect(issues).toEqual([]);
    expect(options.topology.nodes[0].trigger).toEqual({
      enabled: false,
      host: 'AGLIN-FW-STARTI',
      names: [],
      showActive: true,
    });
  });

  /**
   * Topologia salva antes da lista de triggers ativas ganha o recurso **ligado**.
   * Desligado, um elemento vermelho continuaria sem dizer o que caiu — que era
   * a lacuna a fechar; quem achar poluido desliga no editor.
   */
  it('a lista de triggers ativas nasce ligada em vínculo salvo antes dela', () => {
    const [node] = sampleTopology.nodes;
    const { options } = parseTopoFlowOptions({
      topology: { nodes: [{ ...node, trigger: { enabled: true, host: 'AGLIN-FW-STARTI' } }], edges: [] },
    });

    expect(options.topology.nodes[0].trigger?.showActive).toBe(true);
  });

  it('preserva o vinculo completo, inclusive o `refId` ainda nao exposto na UI', () => {
    const [node] = sampleTopology.nodes;
    const trigger = { enabled: true, host: 'AGLIN-FW-STARTI', names: ['Unavailable by ICMP ping'], refId: 'B' };
    const { options } = parseTopoFlowOptions({
      topology: { nodes: [{ ...node, trigger }], edges: [] },
    });

    expect(options.topology.nodes[0].trigger).toEqual({ ...trigger, showActive: true });
  });

  /**
   * Topologia salva quando o vinculo aceitava uma trigger so: o `name` vira o
   * unico item da lista e desaparece do JSON no proximo save. Sem isto, a
   * trigger escolhida sumiria calada no primeiro parse e o elemento passaria a
   * acender com qualquer problema do host.
   */
  it('dobra o `name` unico de uma topologia antiga na lista de triggers', () => {
    const [node] = sampleTopology.nodes;
    const trigger = { enabled: true, host: 'AGLIN-FW-STARTI', name: 'Unavailable by ICMP ping' };
    const { options, issues } = parseTopoFlowOptions({
      topology: { nodes: [{ ...node, trigger }], edges: [] },
    });

    expect(issues).toEqual([]);
    expect(options.topology.nodes[0].trigger).toEqual({
      enabled: true,
      host: 'AGLIN-FW-STARTI',
      names: ['Unavailable by ICMP ping'],
      showActive: true,
    });
    expect(options.topology.nodes[0].trigger).not.toHaveProperty('name');
  });

  /** `name` em branco sempre significou "qualquer trigger do host". */
  it('`name` vazio de topologia antiga vira lista vazia, e nao uma linha em branco', () => {
    const [node] = sampleTopology.nodes;
    const { options } = parseTopoFlowOptions({
      topology: { nodes: [{ ...node, trigger: { enabled: true, host: 'X', name: '  ' } }], edges: [] },
    });

    expect(options.topology.nodes[0].trigger?.names).toEqual([]);
  });

  /**
   * Modo trigger desligado nao pode levar a configuracao junto: e o que faz
   * alternar Metrica <-> Trigger sobreviver a um save (criterio de aceite 1).
   */
  it('mantem a config de metrica e a de trigger lado a lado', () => {
    const [node] = sampleTopology.nodes;
    const { options } = parseTopoFlowOptions({
      topology: {
        nodes: [
          {
            ...node,
            color: { field: 'cpu' },
            value: { field: 'cpu' },
            trigger: { enabled: false, host: 'AGLIN-FW-STARTI' },
          },
        ],
        edges: [],
      },
    });

    const parsed = options.topology.nodes[0];
    expect(parsed.color).toEqual({ field: 'cpu' });
    expect(parsed.value).toEqual({ field: 'cpu' });
    expect(parsed.trigger).toEqual({ enabled: false, host: 'AGLIN-FW-STARTI', names: [], showActive: true });
  });
});

/**
 * O drill-down chegou aos tres elementos que tem superficie clicavel propria —
 * No, Imagem e Texto. Como todo campo opcional do modelo, **ausente significa
 * desligado**, entao nao ha migrador e nenhuma topologia salva antes dele muda
 * de comportamento.
 */
describe('drill-down', () => {
  const semLink = { schemaVersion: 1, topology: sampleTopology };

  it('topologia salva antes do drill-down continua válida e sem link', () => {
    const { options, issues } = parseTopoFlowOptions(semLink);

    expect(issues).toEqual([]);
    expect(options.topology.nodes[0].drilldown).toBeUndefined();
    expect(options.topology.texts[0].drilldown).toBeUndefined();
  });

  it('sobrevive ao round-trip nos três elementos, com nova aba e sem', () => {
    const [node] = sampleTopology.nodes;
    const [text] = sampleTopology.texts;

    const { options, issues } = parseTopoFlowOptions({
      topology: {
        ...sampleTopology,
        nodes: [{ ...node, drilldown: { url: '/d/uid/host?var-host=$host' } }],
        texts: [{ ...text, drilldown: { url: 'https://wiki/runbook', targetBlank: true } }],
        images: [
          {
            id: 'logo',
            position: { x: 0, y: 0 },
            size: { width: 80, height: 80 },
            src: 'topoflow/router',
            color: {},
            zIndex: 0,
            drilldown: { url: '/d/uid/detalhe' },
          },
        ],
      },
    });

    expect(issues).toEqual([]);
    expect(options.topology.nodes[0].drilldown).toEqual({ url: '/d/uid/host?var-host=$host' });
    expect(options.topology.texts[0].drilldown).toEqual({ url: 'https://wiki/runbook', targetBlank: true });
    expect(options.topology.images[0].drilldown).toEqual({ url: '/d/uid/detalhe' });
  });

  /**
   * O `.default('')` do `url` existe para o instante entre ligar o toggle e
   * digitar: o objeto ja e valido, e um link vazio simplesmente nao vira `<a>`.
   */
  it('aceita o vínculo recém-criado, ainda sem endereço', () => {
    const [node] = sampleTopology.nodes;
    const { options, issues } = parseTopoFlowOptions({
      topology: { ...sampleTopology, nodes: [{ ...node, drilldown: {} }] },
    });

    expect(issues).toEqual([]);
    expect(options.topology.nodes[0].drilldown).toEqual({ url: '' });
  });
});

/**
 * O grafico de hover e um booleano opcional nos tres elementos que tem estado
 * por metrica **e** superficie propria. Como todo campo opcional do modelo,
 * ausente significa desligado — sem migrador, e sem mudar nada do que ja estava
 * salvo.
 */
describe('gráfico de hover', () => {
  it('topologia salva antes do gráfico continua válida e sem gráfico', () => {
    const { options, issues } = parseTopoFlowOptions({ schemaVersion: 1, topology: sampleTopology });

    expect(issues).toEqual([]);
    expect(options.topology.nodes[0].chart).toBeUndefined();
  });

  it('sobrevive ao round-trip no nó, no point e na imagem', () => {
    const [node] = sampleTopology.nodes;

    const { options, issues } = parseTopoFlowOptions({
      topology: {
        ...sampleTopology,
        nodes: [{ ...node, chart: true, color: { field: 'cpu' } }],
        points: [{ id: 'ponto', position: { x: 0, y: 0 }, color: { field: 'cpu' }, chart: true, zIndex: 0 }],
        images: [
          {
            id: 'logo',
            position: { x: 0, y: 0 },
            size: { width: 80, height: 80 },
            src: '',
            color: { field: 'cpu' },
            chart: true,
            zIndex: 0,
          },
        ],
      },
    });

    expect(issues).toEqual([]);
    expect(options.topology.nodes[0].chart).toBe(true);
    expect(options.topology.points[0].chart).toBe(true);
    expect(options.topology.images[0].chart).toBe(true);
  });

  /** A aresta nao tem o campo: o painel de hover dela pendura no chip de alarme. */
  it('a conexão não ganhou o campo — e um valor solto ali é descartado', () => {
    const [edge] = sampleTopology.edges;
    const { options } = parseTopoFlowOptions({
      topology: { ...sampleTopology, edges: [{ ...edge, chart: true }] },
    });

    expect(options.topology.edges[0]).not.toHaveProperty('chart');
  });
});

/**
 * A rodada do vínculo direto acrescentou dois campos, os dois opcionais e sem
 * bump de `schemaVersion`. O que estes testes fixam é o que isso exige: nada do
 * que já está salvo em produção pode deixar de validar.
 */
describe('parseTopoFlowOptions — vínculo direto com o Zabbix', () => {
  // Parte de um nó completo: o que está em teste é o `color`, e montar o nó à
  // mão só acrescentaria chances de falhar por um campo obrigatório esquecido.
  const no = (color: unknown) => ({
    schemaVersion: 1,
    topology: { nodes: [{ ...sampleTopology.nodes[0], color }] },
  });

  it('guarda o datasource escolhido no painel', () => {
    const { options, issues } = parseTopoFlowOptions({ schemaVersion: 1, zabbix: { datasource: 'zbx-uid' } });

    expect(issues).toEqual([]);
    expect(options.zabbix?.datasource).toBe('zbx-uid');
  });

  it('painel salvo antes da opção existir continua válido', () => {
    const { options, issues } = parseTopoFlowOptions({ schemaVersion: 1, topology: sampleTopology });

    expect(issues).toEqual([]);
    expect(options.zabbix).toBeUndefined();
  });

  it('guarda host e item do vínculo por métrica', () => {
    const { options, issues } = parseTopoFlowOptions(no({ metric: { host: 'AGLIN-FW', item: 'CPU utilization' } }));

    expect(issues).toEqual([]);
    expect(options.topology.nodes[0].color.metric).toEqual({ host: 'AGLIN-FW', item: 'CPU utilization' });
  });

  it('o field de sempre continua atravessando o parse', () => {
    const { options, issues } = parseTopoFlowOptions(no({ field: 'cpu', fixed: 'blue' }));

    expect(issues).toEqual([]);
    expect(options.topology.nodes[0].color).toEqual({ field: 'cpu', fixed: 'blue' });
  });

  /** Metade de um par não é vínculo — mas também não pode derrubar o parse. */
  it('métrica sem item não invalida a topologia', () => {
    const { options, issues } = parseTopoFlowOptions(no({ metric: { host: 'AGLIN-FW', item: '' } }));

    expect(issues).toEqual([]);
    expect(options.topology.nodes[0].color.metric).toEqual({ host: 'AGLIN-FW', item: '' });
  });
});
