import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Field, Input, useStyles2 } from '@grafana/ui';

import { drilldownHref, isBlockedDrilldown, isInternal } from '../canvas/drilldown';
import { Drilldown } from '../model/types';
import { tfPalette } from '../theme/palette';
import { FieldLabel } from './FieldLabel';
import { ToggleField } from './ToggleField';
import { Note, SectionHead } from './ui/Section';

/**
 * Drill-down do elemento, no desenho do mockup: a secao, a chave, o link, o
 * endereco que vai de fato abrir e a nova aba.
 */
const NOVO_LINK: Drilldown = { url: '' };

interface DrilldownFieldProps {
  value: Drilldown | undefined;
  onChange: (next: Drilldown | undefined) => void;
}

export function DrilldownField({ value, onChange }: DrilldownFieldProps) {
  const styles = useStyles2(getStyles);
  const patch = (changes: Partial<Drilldown>) => onChange({ ...NOVO_LINK, ...value, ...changes });
  const url = value?.url ?? '';
  const alvo = drilldownHref(value);

  return (
    <>
      <SectionHead>Drill-down</SectionHead>
      <ToggleField
        label="Drill-down"
        description="O elemento inteiro vira um link. Clique do meio e Ctrl+clique abrem em outra aba."
        enabled={value !== undefined}
        onToggle={(on) => onChange(on ? NOVO_LINK : undefined)}
      >
        <Field
          label={
            <FieldLabel info="Caminho deste Grafana ou endereço externo. Variáveis do dashboard resolvem no instante do clique.">
              Link
            </FieldLabel>
          }
        >
          <Input
            className={styles.mono}
            value={url}
            placeholder="https://zabbix.corp/tr_events.php  ou  /d/uid/detalhe"
            aria-label="Link do drill-down"
            onChange={(event) => patch({ url: event.currentTarget.value })}
          />
        </Field>

        {/* O endereco que vai de fato abrir, e nao o que foi digitado: sem
            esquema, `www.google.com` cairia num 404 do Grafana. */}
        <Note>
          {alvo ? (
            <>
              {isInternal(alvo) ? 'Abre neste Grafana: ' : 'Sai do Grafana para: '}
              <span className={styles.target}>{alvo}</span>
            </>
          ) : isBlockedDrilldown(value) ? (
            'Endereço bloqueado por segurança: o elemento não vira link.'
          ) : (
            'Sem link.'
          )}
        </Note>

        <ToggleField
          label="Abrir em nova aba"
          description="Recomendado para telão."
          enabled={value?.targetBlank === true}
          onToggle={(on) => patch({ targetBlank: on || undefined })}
        />

        <Note>No editor de painel o clique seleciona o elemento; o link só abre no dashboard.</Note>
      </ToggleField>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  mono: css({ '& input': { fontFamily: "'IBM Plex Mono', ui-monospace, monospace" } }),
  target: css({
    fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
    color: tfPalette(theme).tx,
    wordBreak: 'break-all',
  }),
});
