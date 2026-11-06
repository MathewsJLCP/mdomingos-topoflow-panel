import { z } from 'zod';

import { capImageSrc } from './imageSrc';

/**
 * Fonte da verdade do modelo do TopoFlow.
 *
 * Os tipos TypeScript sao derivados destes schemas em `./types.ts` via `z.infer`.
 * Nunca declarar um tipo do modelo a mao — declare o schema aqui.
 */

/** Versao do formato serializado em `panel.options`. Incrementar exige um migrador. */
export const SCHEMA_VERSION = 1;

/**
 * Propriedade que pode ser fixa ou dirigida por um field do DataFrame (ADR-P04).
 *
 * `fixed` e opcional de proposito: o veneer do core (`@grafana/schema`) o torna
 * obrigatorio, mas nao importamos aquele tipo — nunca passamos estes objetos
 * para uma API do Grafana, entao o acoplamento so custaria (Addendum A §2.1).
 */
export const colorDimensionSchema = z.object({
  /** Nome de cor do tema (ex.: 'green', 'text') ou hex. */
  fixed: z.string().optional(),
  /** Display name do field, obtido com `getFieldDisplayName`. */
  field: z.string().optional(),
  /**
   * A mesma pergunta que `field` responde — **qual serie observar** —, mas
   * nomeada como o Zabbix a nomeia, e nao como o frame a nomeia.
   *
   * Existe porque escolher pelo nome do field exige que a query ja traga aquela
   * metrica: e a ordem invertida do trabalho real, em que o usuario sabe o host
   * e o item muito antes de haver query. Com host e item, o editor pergunta ao
   * Zabbix (ver `data/zabbixApi.ts`) e o vinculo nasce antes do dado.
   *
   * `field` continua valido para sempre: e o formato de tudo que ja esta salvo
   * em producao. Quem traduz um no outro e `stateFieldName`, em
   * `data/dimensions.ts` — e e la que esta a regra de precedencia.
   *
   * Os dois nunca sao gravados juntos pelo editor: sao dois nomes para a mesma
   * serie, e mante-los lado a lado seria uma segunda fonte da verdade livre para
   * discordar da primeira.
   */
  metric: z
    .object({
      /** Nome do host no Zabbix, visivel ou tecnico. */
      host: z.string(),
      /** Nome do item **ja expandido** — ver `expandItemName`. */
      item: z.string(),
    })
    .optional(),
});

/**
 * O core tem um terceiro modo, `template`, que interpola variaveis. Nao
 * implementamos agora; ampliar um enum depois e retrocompativel com dados ja
 * salvos, entao isso nao gera migracao.
 */
export const textDimensionSchema = z.object({
  mode: z.enum(['fixed', 'field']),
  fixed: z.string().optional(),
  field: z.string().optional(),
});

/**
 * "Exibir valor" do no. A presenca do objeto e o toggle; o conteudo diz quais
 * metricas aparecem.
 *
 *   - `fromState` — as metricas que definem o estado (todas, na v1.4, que pode
 *     ter mais de uma). Ausente significa **ligado, a menos que haja `field`**:
 *     um no salvo antes da v1.4 com `field` escolhido exibia so aquele field, e
 *     continua exibindo so ele.
 *   - `fields` — metricas extras, alem das do estado.
 *   - `field` — a metrica unica de antes da v1.4. Lida como mais uma extra.
 */
export const valueDimensionSchema = z.object({
  field: z.string().optional(),
  fromState: z.boolean().optional(),
  fields: z.array(z.string()).optional(),
});

/**
 * Regras de estado por elemento, sobre o valor do field em `color.field`.
 *
 * **E a unica fonte de cor por metrica do elemento.** Ate 2026-09-02 ela
 * coexistia com o pipeline nativo do Grafana (decisao D8): sem regra propria, o
 * elemento era pintado pelos thresholds do field. A coexistencia caiu porque
 * misturava duas telas numa cor so — a Base escolhida no elemento perdia para
 * um step configurado no painel de opcoes, sem nada dizer isso a quem editava.
 * Lista vazia (ou campo ausente) significa hoje: sem estado, vale a Base.
 *
 * Duas diferencas deliberadas em relacao ao `ThresholdsConfig` do core:
 *
 *   - **Nao existe step base dentro da lista.** No core o base e o `-Infinity`,
 *     que pinta tudo abaixo da primeira regra — e a fonte do "verde por
 *     omissao". Aqui, valor abaixo de todas as regras significa "sem estado", e
 *     a cadeia de cor segue para `color.fixed`, que o editor apresenta como a
 *     linha **Base** ao pe da lista. E o mesmo dado de sempre, no lugar onde o
 *     usuario do Grafana espera encontra-lo.
 *   - **So modo absoluto.** O modo percentual do core depende de min/max do
 *     field, que nem sempre existe; um seletor de modo que so funciona as vezes
 *     e pior do que nao ter seletor. `mode` pode entrar depois como campo
 *     opcional, sem migracao.
 */
/** Casos que o valor sozinho nao expressa — os "Special" do Value mappings. */
export const specialMatchSchema = z.enum(['null', 'nan', 'null+nan', 'true', 'false', 'empty']);

/**
 * Severidade de trigger do Zabbix, de *Not classified* (0) a *Disaster* (5).
 *
 * Vive aqui, e nao em `data/problems.ts`, desde que virou dado **persistido**:
 * uma regra de severidade fica salva em `panel.options`, e a regra do projeto e
 * que todo tipo do modelo nasce do Zod. O `problems.ts` importa este tipo em vez
 * de manter a sua propria copia — enquanto eram duas listas escritas a mao, nada
 * impedia uma ganhar um nivel e a outra nao.
 *
 * Uniao de literais, e nao `z.number().min(0).max(5)`, porque so a primeira
 * forma faz o `z.infer` devolver `0 | 1 | 2 | 3 | 4 | 5` — o que permite ao
 * compilador cobrar os seis casos de todo `Record<Severity, ...>`.
 */
export const severitySchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

/**
 * Movimento que o elemento ganha enquanto esta em alerta.
 *
 * Cor sozinha nao chama atencao num telao: um elemento vermelho parado ao lado
 * de outro vermelho parado nao diz qual acabou de cair. O movimento e o que
 * separa "esta ruim" de "acabou de ficar ruim".
 *
 * A animacao e **coluna da regra**, nos dois eixos: cada faixa e cada severidade
 * anima do seu jeito (`>= 75` pulsa, `> 90` faz radar; *High* pulsa, *Disaster*
 * faz radar). Onde a regra estiver, esta a animacao dela.
 */
export const alertAnimationSchema = z.enum(['pulse', 'blink', 'radar']);

/**
 * **Aposentado.** Era o "Animação de alerta" do elemento, com um `fromSeverity`
 * que dizia "anime deste nivel para cima".
 *
 * Nasceu porque, quando a animacao chegou ao eixo de trigger, nao havia lista de
 * severidades na tela — amarrar a animacao a uma regra obrigaria a definir uma
 * cor so para poder animar, sobrescrevendo o mapa do Zabbix sem querer. A escada
 * de severidades tirou esse obstaculo: as seis linhas estao sempre la, com as
 * cores padrao, e a animacao virou uma coluna delas. O `fromSeverity` deixou de
 * ter o que responder — "deste nivel para cima" e o que a propria escada mostra.
 *
 * Continua no schema **so para leitura**: topologias salvas antes disso ainda
 * trazem o campo, e ele segue animando ate a primeira edicao da escada, que o
 * dobra para dentro das regras e o apaga (ver `foldAlertIntoLadder`). Nao ha
 * mais nenhuma UI que o escreva.
 */
export const elementAlertSchema = z.object({
  animation: alertAnimationSchema,
  /** A partir desta severidade, inclusive. */
  fromSeverity: severitySchema.default(0),
});

/**
 * Uma regra do bloco Thresholds.
 *
 * Junta num modelo so os dois mecanismos que o Grafana mantem separados: o
 * **Thresholds** (faixa aberta, "a partir de X") e o **Value mappings** (valor
 * exato, faixa fechada, regex e casos especiais). Separados, configurar um
 * elemento exigia visitar dois lugares que produzem a mesma coisa — uma cor e
 * um texto — com precedencias que so quem conhece o core sabe prever.
 *
 * **Cor e obrigatoria em toda regra**, e e o desvio deliberado em relacao ao
 * Value mappings do core, onde ela e opcional. Uma regra sem cor so produziria
 * texto, e num elemento de topologia o texto e o acessorio: quem carrega o
 * estado e a cor. Deixar a cor opcional obrigaria a cadeia de cor a devolver
 * "sem estado, mas com texto", um quarto caso que nenhum consumidor sabe pintar.
 */
export const elementRuleSchema = z.preprocess(
  // Regras salvas antes dos tipos novos nao tem `type` e sao todas threshold.
  // Um `.default()` no discriminador nao resolveria: o zod 4 aplica o default
  // *depois* de rotear, entao o objeto legado falharia antes de chegar la — a
  // mesma armadilha ja documentada em `triggerBindingSchema`.
  (raw) => (typeof raw === 'object' && raw !== null && !('type' in raw) ? { ...raw, type: 'threshold' } : raw),
  z.discriminatedUnion('type', [
    /** A partir deste valor, inclusive. */
    z.object({
      type: z.literal('threshold'),
      value: z.number(),
      color: z.string(),
      label: z.string().optional(),
      animation: alertAnimationSchema.optional(),
    }),
    /** Valor exato, comparado como texto. */
    z.object({
      type: z.literal('value'),
      match: z.string(),
      color: z.string(),
      label: z.string().optional(),
      animation: alertAnimationSchema.optional(),
    }),
    /** Faixa fechada: `from <= valor <= to`. */
    z.object({
      type: z.literal('range'),
      from: z.number(),
      to: z.number(),
      color: z.string(),
      label: z.string().optional(),
      animation: alertAnimationSchema.optional(),
    }),
    z.object({
      type: z.literal('regex'),
      pattern: z.string(),
      color: z.string(),
      label: z.string().optional(),
      animation: alertAnimationSchema.optional(),
    }),
    z.object({
      type: z.literal('special'),
      match: specialMatchSchema,
      color: z.string(),
      label: z.string().optional(),
      animation: alertAnimationSchema.optional(),
    }),
    /**
     * A partir desta severidade de trigger, inclusive.
     *
     * E a unica regra que **nao** olha para o valor de um field: ela e avaliada
     * contra a severidade do alarme, no nivel 0 da cadeia de cor. Sem nenhuma
     * regra deste tipo, o alarme continua pintado pelo mapa de severidade do
     * Zabbix — que e o comportamento de sempre e o default de quem nao configura
     * nada.
     *
     * Convive na mesma lista com as regras de metrica de proposito: alternar
     * Metrica <-> Trigger no editor nunca descartou configuracao, e nao seria
     * agora que passaria a descartar. Quem separa as duas e a resolucao, em
     * `data/thresholds.ts`.
     */
    z.object({
      type: z.literal('severity'),
      atLeast: severitySchema,
      color: z.string(),
      label: z.string().optional(),
      /**
       * Severidade **desligada**: o elemento ignora alarmes deste nivel e fica
       * na cor Base, como se nao houvesse problema nenhum.
       *
       * Serve para o ruido conhecido — um parque cheio de *Information* que
       * ninguem atende deixaria o mapa inteiro aceso o tempo todo, e um mapa
       * sempre aceso nao avisa nada. Ausente significa ligada: e o
       * comportamento de sempre, e por isso nao ha migrador.
       */
      enabled: z.boolean().optional(),
      /**
       * Mesmo campo das regras de metrica, pelo mesmo motivo: a animacao
       * pertence a regra que casou, e nao ao elemento. Foi o que aposentou o
       * `elementAlertSchema` — ver o comentario dele.
       */
      animation: alertAnimationSchema.optional(),
    }),
  ])
);

export const elementThresholdsSchema = z.object({
  // O nome `steps` fica por retrocompatibilidade: renomear exigiria migrador
  // para ganhar nada — a lista sempre foi a lista de regras.
  steps: z.array(elementRuleSchema).default([]),
});

/**
 * Uma metrica **alem da primeira** que define o estado do elemento (v1.4).
 *
 * A primeira continua onde sempre esteve — `color.field`/`color.metric` com as
 * regras em `thresholds.steps` —, entao topologia salva antes da v1.4 nao muda
 * de forma e nao ha migrador. As seguintes vivem em `extraMetrics`, cada uma com
 * o proprio vinculo e as proprias regras. Com mais de uma, vence a regra de
 * maior gravidade (ver `elementColor`).
 */
export const metricBindingSchema = z.object({
  field: z.string().optional(),
  metric: z
    .object({
      host: z.string(),
      item: z.string(),
    })
    .optional(),
  steps: z.array(elementRuleSchema).default([]),
});

/**
 * Vinculo a uma trigger do Zabbix, lida dos frames de uma query em Query Mode
 * *Problems*. O plugin nunca chama a API do Zabbix: os dados entram pelo Query
 * Editor nativo do painel e nos so lemos o `DataFrame`.
 *
 * E um campo **opcional e paralelo** ao binding de metrica, e nao um
 * `discriminatedUnion` sobre um `mode`. Duas razoes:
 *
 *   1. Retrocompatibilidade sai de graca — uma topologia salva antes desta
 *      feature nao tem `trigger` e carrega identica, sem migrador. A alternativa
 *      obvia nao funciona: um `z.literal('metric').default('metric')` dentro de
 *      `discriminatedUnion` nao salva o objeto legado, porque o zod 4 aplica o
 *      default *depois* de rotear pelo discriminador — o parse falha com "No
 *      matching discriminator" antes de chegar la.
 *   2. As duas configuracoes coexistem no JSON, entao alternar Metrica <->
 *      Trigger no editor nao descarta nada — nem depois de salvar e recarregar.
 *
 * Por isso `enabled` e persistido em vez de a precedencia sair da presenca do
 * objeto: e a flag que decide quem manda em runtime, e ela pode voltar a `false`
 * sem levar a configuracao da trigger junto.
 */
/**
 * Dobra o `name` unico das topologias salvas antes de o vinculo aceitar mais de
 * uma trigger.
 *
 * Mesma armadilha do `elementRuleSchema`: um `.default([])` sozinho nao resolve,
 * porque o objeto legado nao chega com o campo *vazio* — ele chega com o campo
 * *antigo*, e sem alguem para traduzir a escolha do usuario sumiria calada no
 * primeiro parse. Dobrar aqui e o que dispensa migrador: o `name` vira o unico
 * item da lista, e o proximo save grava so `names`.
 *
 * `name` em branco vira lista vazia, e nao `['']`, porque em branco sempre
 * significou "qualquer trigger do host" — que e o que a lista vazia diz agora.
 */
function foldLegacyTriggerName(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null || !('name' in raw)) {
    return raw;
  }

  const { name, ...rest } = raw as { name?: unknown };

  // Ja migrado (ou escrito a mao com os dois campos): a lista manda.
  if ('names' in rest) {
    return rest;
  }

  return { ...rest, names: typeof name === 'string' && name.trim() ? [name] : [] };
}

export const triggerBindingSchema = z.preprocess(
  foldLegacyTriggerName,
  z.object({
    // `.default` porque o editor escreve o objeto no instante em que o usuario
    // abre o modo trigger, antes de existir host escolhido.
    enabled: z.boolean().default(false),
    /**
     * `hosts[].name` (o nome que o operador ve) ou `hosts[].host` (o nome
     * tecnico). O match aceita os dois — ver `matchesHost` em `data/problems.ts`.
     */
    host: z.string(),
    /**
     * Descricoes das triggers que acendem o elemento. A relacao entre elas e
     * **OU**: qualquer uma em PROBLEM acende, e todas as que estiverem alarmando
     * ao mesmo tempo entram na lista e no contador.
     *
     * **Lista vazia significa qualquer trigger do host** — e o mesmo que o `name`
     * ausente dizia antes de a lista existir, e segue sendo o default de quem so
     * escolhe o host. Entrada em branco no meio da lista e rascunho do editor e o
     * resolver a ignora, em vez de deixa-la abranger tudo por acidente.
     */
    names: z.array(z.string()).default([]),
    /**
     * Query de Problems especifica. Reservado: esta versao varre todos os frames
     * de Problems e nao expoe a escolha na UI. Fica declarado para que expor
     * depois nao custe uma migracao.
     */
    refId: z.string().optional(),
    /**
     * Lista as triggers em PROBLEM logo abaixo do elemento.
     *
     * `.default(true)` e deliberado: sem a lista, um elemento vermelho diz que
     * algo caiu e nao **o que** caiu — que era exatamente a lacuna relatada. O
     * hover responde, mas so para quem tem mouse e sabe que ha algo ali; num
     * telao de parede a resposta precisa estar na tela. Por isso quem ja tem
     * topologia salva ganha a lista ligada, e nao desligada.
     */
    showActive: z.boolean().default(true),
    /**
     * De que lado do elemento a lista aparece. Ausente significa `bottom`, que era
     * o unico lugar possivel ate aqui — e por isso nao ha migrador.
     *
     * A escolha existe porque a topologia decide por ela: um elemento na borda
     * inferior do painel joga a lista para fora da area visivel, e um no com
     * vizinho logo abaixo cobre o vizinho. Quem sabe onde ha espaco e quem
     * desenhou o mapa.
     */
    activePosition: z.enum(['top', 'bottom', 'left', 'right']).optional(),
    /**
     * Formato da extensao: os nomes das triggers ou so a contagem.
     *
     * Ausente significa `list`, que era o unico formato possivel ate aqui — e
     * por isso nao ha migrador. `count` troca as ate tres linhas por uma so,
     * "4 incidentes ativos", para a topologia densa em que o operador quer saber
     * **quanto** esta caindo e vai ao hover para saber **o que**.
     */
    activeDisplay: z.enum(['list', 'count', 'inside', 'strip', 'counter', 'total']).optional(),
  })
);

/**
 * Drill-down: para onde o clique no elemento leva.
 *
 * **Ausente significa desligado**, como o `secondaryText` do no e a placa do
 * texto — nao ha flag separada para manter em sincronia.
 *
 * `url` guarda o que o usuario digitou, cru, e nao o endereco ja resolvido. E o
 * que permite escrever `/d/uid/host?var-host=$host`: as variaveis do dashboard
 * so tem valor no instante do clique, e congelar a interpolacao no que fica
 * salvo produziria um link que aponta para o host de quem configurou o painel.
 *
 * Nao ha campo de "titulo" nem lista de varios links, ao contrario do
 * `DataLink` do core: o gatilho aqui e o elemento inteiro, e um elemento so tem
 * um clique. Uma lista precisaria de um menu, e um menu no canvas disputaria com
 * o menu de contexto e com o painel de triggers.
 */
export const drilldownSchema = z.object({
  /**
   * Caminho interno (`/d/uid/...`) ou URL completa. O caminho interno navega
   * dentro do Grafana, sem recarregar a pagina; ver `canvas/drilldown.ts`.
   */
  url: z.string().default(''),
  /**
   * Abre noutra aba. Ausente e a mesma aba, que e o default do `DataLink` do
   * core — e o certo para o operador que vai e volta pelo botao de voltar.
   * Ligado e para o telao, onde sair do mapa nao e uma opcao.
   */
  targetBlank: z.boolean().optional(),
});

/**
 * Grupo do elemento (v1.4). Elementos com o mesmo `groupId` andam juntos: o
 * clique seleciona o grupo inteiro e arrastar um arrasta todos.
 *
 * **Ausente significa sem grupo**, como os demais opcionais do modelo — e por
 * isso nao ha migrador. E um rotulo, e nao uma colecao `groups` na topologia:
 * o grupo nao tem atributo nenhum alem de quem pertence a ele, e uma lista
 * separada seria uma segunda fonte da verdade livre para discordar dos
 * proprios elementos (um grupo apontando para um id que ja foi apagado).
 */
export const groupIdSchema = z.string().min(1).optional();

export const topoNodeSchema = z.object({
  id: z.string().min(1),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  size: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
  }),
  presentation: z.object({
    /**
     * Chave da biblioteca em `canvas/icons`. String livre, e nao enum, para que
     * remover ou renomear um icone nao invalide topologias salvas — quem nao for
     * reconhecido cai no `generic`.
     */
    icon: z.string().optional(),
    // `.default(true)` e o que faz um no salvo antes deste campo continuar
    // exibindo o icone, que era o unico comportamento possivel ate aqui.
    showIcon: z.boolean().default(true),
    /**
     * Qual variante de cor usar, nos icones que tem varias.
     *
     * **Ausente significa `state`**: a cor acompanha o estado do elemento, que e
     * o que da sentido a um pack de figuras coloridas — sem isso, um icone
     * vermelho ficaria vermelho tambem com tudo em ordem. Fica `.optional()` em
     * vez de `.default('state')` porque ausente ja diz exatamente isso, e um
     * default explicito obrigaria todo objeto de presentation escrito a mao (e
     * todo teste) a carregar um campo que nao muda nada.
     */
    iconTone: z.enum(['state', 'gray', 'blue', 'green', 'yellow', 'orange', 'red']).optional(),
    primaryText: textDimensionSchema,
    /** Ausente significa desligado — nao ha flag separada. */
    secondaryText: textDimensionSchema.optional(),
  }),
  value: valueDimensionSchema.optional(),
  /**
   * Cor de destaque. Pousa no icone, na capsula e no badge — nunca no card
   * (Anexo A.2). `fixed` vazio significa neutro, nao branco.
   */
  color: colorDimensionSchema,
  trigger: triggerBindingSchema.optional(),
  /** Ausente = sem regra de metrica; o elemento repousa na Base (`color.fixed`). */
  thresholds: elementThresholdsSchema.optional(),
  /** Metricas de estado alem da primeira (v1.4). Ver `metricBindingSchema`. */
  extraMetrics: z.array(metricBindingSchema).optional(),
  /** Ausente = o elemento nao se move em alerta. */
  alert: elementAlertSchema.optional(),
  /** Ausente = clicar no no nao leva a lugar nenhum. */
  drilldown: drilldownSchema.optional(),
  /**
   * Grafico da metrica ao passar o mouse sobre o elemento.
   *
   * **Ausente significa desligado**, como os demais campos opcionais do modelo — e
   * o default e desligado de proposito: um painel de parede com trinta elementos
   * nao quer um grafico abrindo a cada movimento do ponteiro.
   *
   * E um booleano, e nao um objeto com o field a plotar, porque a metrica ja esta
   * escolhida: e a mesma de `color.field`, a que decide o estado do elemento. Um
   * segundo seletor abriria a porta para o grafico mostrar uma serie e a cor vir
   * de outra — dois numeros no mesmo elemento, sem nada na tela dizendo qual e
   * qual.
   *
   * So vale no modo Metrica. No modo Trigger nao ha field escolhido, e o hover ja
   * tem dono: a lista de triggers em PROBLEM (ver `ElementHover`).
   */
  chart: z.boolean().optional(),
  groupId: groupIdSchema,
  zIndex: z.number().int(),
});

export const topoEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  style: z.enum(['solid', 'dashed', 'dotted']),
  shape: z.enum(['curved', 'straight']),
  color: colorDimensionSchema,
  trigger: triggerBindingSchema.optional(),
  /** Ausente = sem regra de metrica; a aresta repousa na Base (`color.fixed`). */
  thresholds: elementThresholdsSchema.optional(),
  /** Metricas de estado alem da primeira (v1.4). Ver `metricBindingSchema`. */
  extraMetrics: z.array(metricBindingSchema).optional(),
  /** Ausente = a aresta nao se move em alerta. */
  alert: elementAlertSchema.optional(),
  width: z.number().min(1).max(10),
  /**
   * Rotulo estatico. Texto interpolado com valor de metrica e um recurso de
   * binding, nao de geometria, e fica para depois — por isso `string` simples e
   * nao uma `TextDimension`.
   */
  label: z.string().optional(),
  // `.default` pelo mesmo motivo dos arrays da topologia: arestas salvas antes
  // do Bloco 4 continuam validando sem migracao.
  animation: z.enum(['none', 'dash-flow', 'flow', 'pulse']).default('none'),
  /**
   * Vertices do trajeto (v1.4), em coordenadas do canvas, da origem ao destino.
   * Ausente ou vazio = linha direta, como sempre foi.
   */
  waypoints: z.array(z.object({ x: z.number(), y: z.number() })).optional(),
});

/** No simplificado: ancora de roteamento. Sem texto, sem icone, sem valor. */
export const topoPointSchema = z.object({
  id: z.string().min(1),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  color: colorDimensionSchema,
  trigger: triggerBindingSchema.optional(),
  /** Ausente = sem regra de metrica; o point repousa na Base (`color.fixed`). */
  thresholds: elementThresholdsSchema.optional(),
  /** Metricas de estado alem da primeira (v1.4). Ver `metricBindingSchema`. */
  extraMetrics: z.array(metricBindingSchema).optional(),
  /** Ausente = o point nao se move em alerta. */
  alert: elementAlertSchema.optional(),
  /** Grafico da metrica no hover. Ver `chart` em `topoNodeSchema`. */
  chart: z.boolean().optional(),
  groupId: groupIdSchema,
  zIndex: z.number().int(),
});

/**
 * Retangulo de agrupamento. Sempre atras dos demais elementos.
 *
 * `color` e uma string simples, nao uma `ColorDimension`: o postit e estatico
 * por decisao do PRD, e um tipo que nao aceita `field` torna isso impossivel de
 * violar por engano no editor.
 */
export const topoPostitSchema = z.object({
  id: z.string().min(1),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  size: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
  }),
  title: z.string().optional(),
  /**
   * Canto em que a tag de titulo pousa sobre a borda.
   *
   * `.default` mantem o postit salvo antes deste campo exatamente onde estava —
   * o titulo sempre viveu no canto superior esquerdo.
   */
  titlePosition: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right']).default('top-left'),
  color: z.string(),
  /** Escala 0..1, nao 0..100: e o que ja esta persistido nos dashboards. */
  opacity: z.number().min(0).max(1),
  // `.default` pelo mesmo motivo dos arrays da topologia: postits salvos antes
  // deste campo continuam validando sem migracao.
  borderStyle: z.enum(['solid', 'dashed', 'dotted']).default('solid'),
  /**
   * Espessura da borda em px. Era fixa em 1.5 e passou a 2, que e a espessura
   * em que o traco se sustenta sobre o fundo do canvas nos dois temas.
   */
  borderWidth: z.number().min(0).max(10).default(2),
  groupId: groupIdSchema,
  zIndex: z.number().int(),
});

/**
 * Placa de fundo do texto. **Ausente significa transparente** — nao existe flag
 * separada, pelo mesmo motivo do `secondaryText` do no.
 *
 * Objeto aninhado, e nao dois campos soltos ao lado de `fontSize`: cor e
 * opacidade so fazem sentido juntas, e separadas abririam dois estados
 * invalidos que alguem teria de tratar em runtime — cor sem opacidade e
 * opacidade sem cor.
 *
 * `color` guarda **nome de cor do tema** (ou hex), nunca o valor resolvido:
 * resolver na hora de salvar congelaria o tema vigente no momento da edicao, e a
 * placa ficaria clara num dashboard escuro.
 */
export const textBackgroundSchema = z.object({
  color: z.string(),
  /** Escala 0..1, como no postit. */
  opacity: z.number().min(0).max(1),
});

/**
 * Texto solto sobre o canvas. Elemento decorativo: nao tem estado.
 *
 * `trigger` viveu aqui e saiu (decisao D5). O Texto era o unico elemento em que
 * a fonte de estado nao pagava o proprio custo — o glifo e a unica superficie
 * que ele tem, entao acender significava trocar a cor da letra, e um texto que
 * muda de cor sozinho se le como erro de renderizacao, nao como alarme.
 *
 * `color` continua sendo uma `ColorDimension` por retrocompatibilidade: e o que
 * ja esta salvo. Mas o editor so escreve `fixed`, e o canvas so le `fixed` — um
 * `field` que tenha sobrado de antes fica inerte, sem migrador e sem repintar
 * texto nenhum.
 */
export const topoTextSchema = z.object({
  id: z.string().min(1),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  content: textDimensionSchema,
  color: colorDimensionSchema,
  background: textBackgroundSchema.optional(),
  fontSize: z.number().min(8).max(72),
  /** Ausente = clicar no texto nao leva a lugar nenhum. */
  drilldown: drilldownSchema.optional(),
  groupId: groupIdSchema,
  zIndex: z.number().int(),
});

/**
 * Fundo da imagem. **Ausente significa desligado** — nao existe flag separada,
 * pelo mesmo motivo do `secondaryText` do no e da placa do texto.
 *
 * Os dois modos respondem a perguntas diferentes, e por isso convivem num campo
 * so em vez de virarem dois elementos:
 *
 *   - `fixed` e identidade visual: a placa branca atras de um logo PNG que
 *     sumiria no canvas escuro.
 *   - `state` e monitoramento: a mesma caixa passa a ser pintada pela cadeia de
 *     cor do elemento (metrica ou trigger, com os thresholds de sempre), e a
 *     imagem vira o rotulo de um estado — que e como os mapas do Zabbix usam
 *     icone.
 *
 * `color` guarda **nome de cor do tema** (ou hex), nunca o valor resolvido, e so
 * vale no modo `fixed`: no modo `state` quem manda e o estado. Guardar os dois
 * lados preserva a cor solida escolhida ao alternar os modos, do mesmo jeito que
 * alternar Metrica <-> Trigger nunca descartou configuracao.
 *
 * `opacity` vale nos dois: e o que permite tanto uma placa discreta quanto um
 * alarme solido atras de um PNG transparente.
 */
export const imageBackgroundSchema = z.object({
  mode: z.enum(['fixed', 'state']),
  color: z.string(),
  opacity: z.number().min(0).max(1),
});

/**
 * Imagem carregada pelo usuario. O unico elemento cujo conteudo principal nao e
 * texto nem forma: e um arquivo.
 *
 * `src` guarda **data URI** (o upload) ou **URL** (o caminho colado). Sao a
 * mesma coisa para o `<img>`, e por isso um campo so: o que muda e de onde o
 * dado veio, nao o que ele e. O upload vive dentro do JSON do dashboard porque
 * o plugin nao tem backend para onde subir arquivo — dai o teto de tamanho no
 * editor, e dai a URL continuar existindo como saida para imagem grande.
 *
 * Conecta como no e point (o pedido do cliente), tem texto com metrica como o
 * rotulo da conexao, e tem estado **so quando o fundo esta no modo `state`** —
 * sem fundo nao ha superficie onde a cor pousaria, e pintar a propria imagem
 * seria descaracteriza-la.
 */
export const topoImageSchema = z.object({
  id: z.string().min(1),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  size: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
  }),
  /**
   * Data URI (upload), URL, **ou uma chave da biblioteca de icones**
   * (`topoflow/router`).
   *
   * Os tres no mesmo campo pelo mesmo motivo que data URI e URL ja dividiam um:
   * o que muda e de onde o desenho vem, nao o que ele e. E o que faz a
   * biblioteca chegar a Imagem sem migrador e sem um segundo campo que
   * precisaria ser mantido em sincronia com este.
   *
   * O teto do upload vale aqui tambem, e nao so no editor. O `transform` zera o
   * campo em vez de reprovar o valor. Ver `capImageSrc`.
   */
  src: z.string().default('').transform(capImageSrc),
  /**
   * Como a figura ocupa a caixa. `contain` preserva a proporcao e e o padrao:
   * um logo esticado e pior que um logo com sobra ao lado.
   */
  fit: z.enum(['contain', 'cover', 'fill']).default('contain'),
  /**
   * Legenda, com `${nome do field}` interpolado — a mesma gramatica do rotulo da
   * conexao. String simples, e nao `TextDimension`: aqui nao existe o modo "so o
   * valor de um field", porque o template ja o cobre escrevendo `${field}`
   * sozinho, e o radio Fixo|Field so ocuparia espaco.
   */
  text: z.string().optional(),
  /**
   * Tamanho da legenda. `.default` porque imagens salvas antes deste campo
   * existirem continuam validando — e 12 e o tamanho com que elas ja apareciam.
   */
  fontSize: z.number().min(8).max(72).default(12),
  background: imageBackgroundSchema.optional(),
  /** Mesmo campo do no: qual variante usar num icone da biblioteca que tem varias. */
  iconTone: z.enum(['state', 'gray', 'blue', 'green', 'yellow', 'orange', 'red']).optional(),
  /** Base da cadeia de cor quando o fundo esta em `state`. */
  color: colorDimensionSchema,
  trigger: triggerBindingSchema.optional(),
  thresholds: elementThresholdsSchema.optional(),
  /** Metricas de estado alem da primeira (v1.4). Ver `metricBindingSchema`. */
  extraMetrics: z.array(metricBindingSchema).optional(),
  alert: elementAlertSchema.optional(),
  /** Ausente = clicar na imagem nao leva a lugar nenhum. */
  drilldown: drilldownSchema.optional(),
  /** Grafico da metrica no hover. Ver `chart` em `topoNodeSchema`. */
  chart: z.boolean().optional(),
  groupId: groupIdSchema,
  zIndex: z.number().int(),
});

export const canvasSchema = z.object({
  showGrid: z.boolean(),
  snapToGrid: z.boolean(),
  gridSize: z.number().int().min(4).max(64),
  // `.default` mantem `schemaVersion: 1` valido: um dashboard salvo antes deste
  // campo existir continua validando em vez de cair para os defaults inteiros.
  inlineEditing: z.boolean().default(false),
});

/**
 * A integridade referencial das arestas e resolvida por descarte, nao por erro.
 *
 * Uma aresta pendurada vem tipicamente de JSON editado a mao. Rejeitar a
 * topologia inteira faria o painel cair para os defaults e perder o trabalho do
 * usuario por causa de uma aresta; descartar a aresta perde so a aresta.
 * IDs duplicados quebram a reconciliacao do React Flow, entao caem junto.
 */
export const topologySchema = z
  .object({
    // Os `.default([])` sao o que permite manter `schemaVersion: 1` ao adicionar
    // tipos novos: uma topologia salva so com nodes/edges continua validando.
    nodes: z.array(topoNodeSchema).default([]),
    edges: z.array(topoEdgeSchema).default([]),
    points: z.array(topoPointSchema).default([]),
    postits: z.array(topoPostitSchema).default([]),
    texts: z.array(topoTextSchema).default([]),
    images: z.array(topoImageSchema).default([]),
  })
  .transform(({ nodes, edges, points, postits, texts, images }) => {
    // Um unico espaco de ids para todos os elementos: sao todos `Node` do React
    // Flow, e ids repetidos entre tipos quebrariam a reconciliacao igual.
    const seen = new Set<string>();
    const dedupe = <T extends { id: string }>(items: T[]) =>
      items.filter((item) => {
        if (seen.has(item.id)) {
          return false;
        }
        seen.add(item.id);
        return true;
      });

    const keptNodes = dedupe(nodes);
    const keptPoints = dedupe(points);
    const keptPostits = dedupe(postits);
    const keptTexts = dedupe(texts);
    const keptImages = dedupe(images);

    // Nós, points e imagens aceitam conexao. Postits e textos nunca.
    const connectable = new Set([...keptNodes, ...keptPoints, ...keptImages].map((item) => item.id));

    const edgeIds = new Set<string>();
    const keptEdges = edges.filter((edge) => {
      if (edgeIds.has(edge.id) || !connectable.has(edge.source) || !connectable.has(edge.target)) {
        return false;
      }
      edgeIds.add(edge.id);
      return true;
    });

    return {
      nodes: keptNodes,
      edges: keptEdges,
      points: keptPoints,
      postits: keptPostits,
      texts: keptTexts,
      images: keptImages,
    };
  });

/**
 * O painel falando com o Zabbix por conta propria.
 *
 * **Um interruptor so para as duas coisas** (decisao do usuario em 2026-09-09):
 * ligado, o editor sugere hosts, itens e triggers do catalogo **e** o painel
 * executa a propria query de Problems para os hosts vinculados. Desligado — o
 * padrao —, tudo vem das queries do dashboard, como sempre veio.
 *
 * Separar os dois (sugerir sem buscar) foi tentado e desfeito: era um segundo
 * interruptor para uma pergunta que ninguem faz, e a resposta util e sempre
 * "as duas".
 *
 * Tudo opcional: ausente significa desligado. Por isso nao ha migrador nem bump
 * de `schemaVersion`.
 */
export const zabbixOptionsSchema = z.object({
  /**
   * Liga a secao inteira. Ausente = desligado.
   *
   * E o primeiro campo da secao no painel de opcoes, e todos os outros so
   * aparecem com ele ligado: sem Zabbix escolhido nao ha o que configurar.
   */
  enabled: z.boolean().optional(),
  /**
   * Uid do datasource Zabbix. Aceita variavel (`${zbx}`), interpolada na hora de
   * resolver — ver `resolveZabbixUid` em `data/zabbixApi.ts`.
   *
   * Ausente nao significa "sem Zabbix": com exatamente um datasource Zabbix na
   * instancia, ele e escolhido sozinho.
   */
  datasource: z.string().optional(),
});

export const topoFlowOptionsSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  topology: topologySchema,
  canvas: canvasSchema,
  zabbix: zabbixOptionsSchema.optional(),
});
