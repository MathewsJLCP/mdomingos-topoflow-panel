import React from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';
import { Handle, HandleType, NodeProps, NodeResizeControl, Position, ResizeControlVariant } from '@xyflow/react';

import { resolveTemplate } from '../../data/dimensions';
import { resolveElementColor, stateMetrics } from '../../data/elementColor';
import { ImageSrcKind, cssImageUrl, imageSrcKind } from '../../model/imageSrc';
import { IMAGE_DEFAULT } from '../../model/sizes';
import { ImageBackground } from '../../model/types';
import { TopoIcon, isKnownIcon, resolveIcon } from '../../icons';
import { placeMask, useIconMask } from '../../icons/iconMask';
import { FONT_SANS, TfPalette, resolveTfColor, tfMix, tfPalette } from '../../theme/palette';
import { HangingList, problemFormat, problemRows, useNow } from '../Problems';
import { activeProblems } from '../ActiveTriggers';
import { DrilldownSurface } from '../DrilldownSurface';
import { MetricChart } from '../MetricChart';
import { hasDrilldown } from '../drilldown';
import { alertClass } from '../alertAnimation';
import { iconColor } from '../iconTone';
import { ImageFlowNode } from '../flowTypes';
import { StateLook, stateLook, statusBadge } from '../look';
import { RadarRings } from '../RadarRings';
import { ElementHover } from '../ElementHover';

const HANDLE_CLASS = 'topo-image-handle';
const RADIUS = 12;

const HANDLES: Array<{ position: Position; type: HandleType }> = [
  { position: Position.Top, type: 'target' },
  { position: Position.Right, type: 'source' },
  { position: Position.Bottom, type: 'target' },
  { position: Position.Left, type: 'source' },
];

/** Quanto da caixa o desenho do catalogo ocupa. */
export const ICON_FILL = 0.84;

/**
 * Imagem: uma figura (icone da biblioteca, arquivo ou URL) de tamanho livre,
 * no desenho do mockup.
 *
 * O estado **sempre** vale — pinta o icone, o circulo de status e a lista de
 * problemas. O fundo e opcional: ligado, a caixa ganha a borda do estado e um
 * fundo na cor dele, na opacidade escolhida.
 */
export function ImageNode({ data, selected, dragging }: NodeProps<ImageFlowNode>) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const p = tfPalette(theme);
  const now = useNow();
  const { element, frames, editable } = data;

  const accent = resolveElementColor(element.color, frames, theme, {
    trigger: element.trigger,
    thresholds: element.thresholds,
    extraMetrics: element.extraMetrics,
  });
  const look = stateLook(accent, element.alert, theme);
  const surface = imageSurface(element.background, look, p, theme);

  const caption = element.text ? resolveTemplate(element.text, frames) : '';
  const icon = isKnownIcon(element.src) ? resolveIcon(element.src) : undefined;
  // Upload e URL so carregam o que a regra aceita; ver `model/imageSrc.ts`.
  const file = icon ? undefined : imageSrcKind(element.src);
  const tint = iconColor(accent, element.iconTone, theme);
  const mask = useIconMask(icon);

  const format = problemFormat(element.trigger, false);
  const rows = problemRows(activeProblems(accent, element.trigger), theme, now);
  const badge = statusBadge(look, p);

  // O circulo pousa no canto da silhueta do desenho — sem fundo, a caixa e
  // invisivel, e o canto dela seria um ponto no vazio.
  let badgeAt: React.CSSProperties = { left: 20, top: 0 };
  if (icon && mask && !element.background) {
    const { x, y, scale } = placeMask(mask, element.size.width, element.size.height, ICON_FILL);
    badgeAt = { left: Math.round(x + mask.bbox.x0 * scale + 6), top: Math.round(y + mask.bbox.y0 * scale + 4) };
  }

  const fill = icon ? ICON_FILL : 1;

  return (
    <div
      className={styles.root}
      data-editable={editable || undefined}
      data-selected={selected || data.link === 'source' || undefined}
      data-link={data.link}
      style={{ width: element.size.width }}
    >
      {editable && selected && (
        <NodeResizeControl
          position="bottom-right"
          variant={ResizeControlVariant.Handle}
          minWidth={IMAGE_DEFAULT.minWidth}
          minHeight={IMAGE_DEFAULT.minHeight}
          className={styles.resize}
          style={{ background: p.ac, borderColor: p.fundo }}
        />
      )}

      {look.animation === 'radar' && look.color && (
        <RadarRings color={look.color} radius={RADIUS} style={{ height: element.size.height, bottom: 'auto' }} />
      )}

      <ElementHover
        accent={accent}
        title={element.trigger?.host}
        editable={editable}
        linked={hasDrilldown(element.drilldown)}
        dragging={dragging}
        chart={
          element.chart ? (
            <MetricChart
              frames={frames}
              metrics={stateMetrics(element.color, {
                thresholds: element.thresholds,
                extraMetrics: element.extraMetrics,
              })}
            />
          ) : undefined
        }
      >
        <DrilldownSurface
          drilldown={element.drilldown}
          editable={editable}
          className={cx(styles.box, alertClass(accent, element.alert))}
          style={{ height: element.size.height, background: surface.background, border: surface.border }}
        >
          {icon ? (
            <span className={styles.lib} style={{ width: `${fill * 100}%`, height: `${fill * 100}%` }}>
              <TopoIcon icon={icon} color={tint} size="100%" />
            </span>
          ) : file === 'https' || file === 'upload' ? (
            <span
              role="img"
              className={styles.file}
              style={{ backgroundImage: cssImageUrl(element.src), backgroundSize: FIT[element.fit] }}
            />
          ) : (
            <span className={styles.placeholder}>{PLACEHOLDER[file ?? 'empty']}</span>
          )}

          <span
            className={styles.badge}
            style={{ ...badgeAt, background: badge.background, border: badge.border, color: badge.color }}
          >
            {badge.glyph}
          </span>
        </DrilldownSurface>
      </ElementHover>

      {caption && (
        <div className={styles.caption} style={{ fontSize: element.fontSize }}>
          {caption}
        </div>
      )}

      <HangingList rows={rows} position={element.trigger?.activePosition} format={format} color={look.color} />

      {HANDLES.map(({ position, type }) => (
        <Handle
          key={position}
          id={position}
          type={type}
          position={position}
          className={cx(styles.handle, HANDLE_CLASS)}
          // A raiz cresce com a legenda; as alcas ficam nas bordas da figura.
          style={
            position === Position.Bottom
              ? { top: element.size.height, bottom: 'auto', transform: 'translate(-50%, -50%)' }
              : position === Position.Top
                ? undefined
                : { top: element.size.height / 2 }
          }
        />
      ))}
    </div>
  );
}

const FIT: Record<string, string> = { contain: 'contain', cover: 'cover', fill: '100% 100%' };

/**
 * O que aparece no lugar da figura. Uma URL recusada nao some em silencio: quem
 * olha o mapa ve que ha algo a corrigir, e o editor diz o que e.
 */
const PLACEHOLDER: Record<ImageSrcKind, string> = {
  empty: 'Sem imagem',
  https: 'Sem imagem',
  upload: 'Sem imagem',
  'too-large': 'Imagem acima do limite',
  blocked: 'URL não permitida',
};

/**
 * Borda e fundo da caixa.
 *
 * Sem fundo, a caixa nao aparece. No modo **estado** (o do mockup), a borda e a
 * do estado e o fundo e a cor dele na opacidade escolhida — sem estado, um
 * cinza `rot` mais fraco; sem dado, o hachurado. No modo **solido** (anterior a
 * v1.4), a cor escolhida, sem borda.
 */
export function imageSurface(
  background: ImageBackground | undefined,
  look: StateLook,
  p: TfPalette,
  theme: GrafanaTheme2
): { background: string; border: string } {
  if (!background) {
    return { background: 'transparent', border: '1px dashed transparent' };
  }

  if (background.mode === 'fixed') {
    return {
      background: tfMix(resolveTfColor(background.color, theme), Math.round(background.opacity * 100)),
      border: '1px solid transparent',
    };
  }

  const pct = Math.round(background.opacity * 100);
  switch (look.kind) {
    case 'nodata':
      return {
        background: `repeating-linear-gradient(135deg, ${p.elev} 0 6px, ${p.sup} 6px 12px)`,
        border: `1.5px dashed ${p.apa}`,
      };
    case 'base':
    case 'alarm':
      return { background: tfMix(look.color!, pct), border: `2px solid ${look.color}` };
    default:
      return { background: tfMix(p.rot, Math.round(background.opacity * 60)), border: `1px solid ${p.borda}` };
  }
}

const getStyles = (theme: GrafanaTheme2) => {
  const p: TfPalette = tfPalette(theme);
  return {
    root: css({
      position: 'relative',
      borderRadius: RADIUS,
      fontFamily: FONT_SANS,
      '&[data-selected]': { outline: `2px solid ${p.ac}`, outlineOffset: 4 },
      [`&[data-editable]:hover .${HANDLE_CLASS}`]: { opacity: 1, pointerEvents: 'auto' },
      '&&[data-link="valid"]': {
        cursor: 'crosshair',
        outline: `2px dashed ${p.ac}`,
        outlineOffset: 4,
        '&:hover': { outlineStyle: 'solid' },
      },
      '&[data-link="invalid"]': { opacity: 0.32 },
    }),
    box: css({
      position: 'relative',
      width: '100%',
      borderRadius: RADIUS,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'default',
    }),
    lib: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
    }),
    file: css({
      width: '100%',
      height: '100%',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      borderRadius: 10,
    }),
    placeholder: css({
      width: 'calc(100% - 12px)',
      height: 'calc(100% - 12px)',
      border: `1px dashed ${p.linha}`,
      borderRadius: 8,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      font: `500 11.5px ${FONT_SANS}`,
      color: p.apa,
    }),
    badge: css({
      position: 'absolute',
      transform: 'translate(-50%, -50%)',
      width: 20,
      height: 20,
      boxSizing: 'border-box',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      font: `800 10.5px/1 ${FONT_SANS}`,
      zIndex: 2,
    }),
    caption: css({
      marginTop: 6,
      textAlign: 'center',
      fontWeight: 500,
      lineHeight: 1.3,
      color: p.tx,
      whiteSpace: 'pre-wrap',
    }),
    resize: css({
      '&&': { width: 12, height: 12, border: '2px solid', borderRadius: 3, zIndex: 3 },
    }),
    handle: css({
      '&&': {
        width: 10,
        height: 10,
        minWidth: 10,
        minHeight: 10,
        background: p.sup,
        border: `2px solid ${p.ac}`,
        borderRadius: '50%',
        cursor: 'crosshair',
        opacity: 0,
        pointerEvents: 'none',
      },
    }),
  };
};
