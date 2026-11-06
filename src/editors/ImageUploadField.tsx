import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Button, Field, FileUpload, Input, useStyles2 } from '@grafana/ui';

import { MAX_IMAGE_BYTES, imageSrcKind, isRenderableImageSrc } from '../model/imageSrc';
import { FieldLabel } from './FieldLabel';

/**
 * Escolha do arquivo da imagem.
 *
 * O upload vira **data URI dentro do JSON do dashboard**, e nao um arquivo num
 * servidor: o plugin nao tem backend, entao nao existe para onde subir. Isso tem
 * duas consequencias que a tela precisa assumir em vez de esconder:
 *
 *   - **teto de tamanho.** Base64 cresce ~33% sobre o arquivo, e o JSON inteiro
 *     do dashboard viaja em toda leitura. Um logo de 20 KB nao se nota; uma foto
 *     de 3 MB deixa o dashboard lento para todo mundo que o abrir, inclusive
 *     quem nunca olha para esta imagem.
 *   - **a URL continua existindo.** E a saida para imagem grande e para quem ja
 *     hospeda os icones — o mesmo campo aceita as duas coisas porque, para o
 *     `<img>`, data URI e URL sao a mesma coisa. So `https://`: ver
 *     `model/imageSrc.ts`.
 *
 * O teto (`MAX_IMAGE_BYTES`) mora no modelo porque o schema tambem o aplica.
 */

const formatKB = (bytes: number) => `${Math.round(bytes / 1024)} KB`;

/**
 * Por que o valor atual nao aparece na Imagem. `undefined` quando aparece.
 *
 * Vale para o que ja estava salvo tambem: uma URL `http://` de antes da regra
 * abre o formulario com este aviso, e nao com um campo que parece funcionar.
 */
function srcProblem(value: string): string | undefined {
  switch (imageSrcKind(value)) {
    case 'blocked':
      return (
        'Só endereços https:// são aceitos. Para uma imagem de servidor sem https, ' +
        'baixe o arquivo e envie por aqui.'
      );
    case 'too-large':
      return `A imagem passa do limite de ${formatKB(MAX_IMAGE_BYTES)}. Use uma imagem menor.`;
    default:
      return undefined;
  }
}

interface ImageUploadFieldProps {
  value: string;
  onChange: (next: string) => void;
}

export function ImageUploadField({ value, onChange }: ImageUploadFieldProps) {
  const styles = useStyles2(getStyles);
  const [error, setError] = React.useState<string | undefined>();
  // O erro da ultima acao manda; sem ele, o problema do valor atual.
  const message = error ?? srcProblem(value);

  const readFile = (file: File) => {
    // O `accept` do input e sugestao para o seletor de arquivos, nao trava:
    // "Todos os arquivos" deixa escolher um PDF, que viraria `data:application/pdf`.
    if (!file.type.startsWith('image/')) {
      setError('O arquivo não é uma imagem.');
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setError(
        `A imagem tem ${formatKB(file.size)} e o limite é ${formatKB(MAX_IMAGE_BYTES)}. ` +
          'Use uma imagem menor ou cole a URL de uma imagem hospedada.'
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setError(undefined);
      onChange(String(reader.result));
    };
    reader.onerror = () => setError('Não foi possível ler o arquivo.');
    reader.readAsDataURL(file);
  };

  return (
    <Field
      label={
        <FieldLabel info={`Envie um arquivo de até ${formatKB(MAX_IMAGE_BYTES)} ou cole a URL https:// de uma imagem.`}>
          Imagem
        </FieldLabel>
      }
    >
      <div className={styles.wrapper}>
        {isRenderableImageSrc(value) && (
          // A miniatura e a confirmacao de que o arquivo certo entrou — sobretudo
          // no caminho da URL, onde nada garante que o endereco resolve.
          <img className={styles.preview} src={value} alt="" />
        )}

        <div className={styles.actions}>
          <FileUpload
            accept="image/*"
            onFileUpload={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) {
                readFile(file);
              }
              // Zera o input: escolher o **mesmo** arquivo depois de um erro nao
              // dispara `change` nenhum se o valor anterior continuar la.
              event.currentTarget.value = '';
            }}
          />

          {value && (
            <Button variant="secondary" fill="text" size="sm" icon="trash-alt" onClick={() => onChange('')}>
              Remover
            </Button>
          )}
        </div>

        <Input
          value={isDataUri(value) ? '' : value}
          placeholder={isDataUri(value) ? 'Arquivo enviado — cole uma URL para substituir' : 'https://…'}
          aria-label="URL da imagem"
          onChange={(event) => {
            setError(undefined);
            onChange(event.currentTarget.value);
          }}
        />

        {message && <div className={styles.error}>{message}</div>}
      </div>
    </Field>
  );
}

/**
 * O campo de URL nao mostra o data URI: sao dezenas de milhares de caracteres, e
 * um `Input` com isso dentro trava a digitacao e nao diz nada a ninguem. Vazio
 * com o placeholder explicando e mais honesto — e a miniatura acima ja prova que
 * ha imagem.
 */
function isDataUri(value: string): boolean {
  return value.startsWith('data:');
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  }),
  preview: css({
    alignSelf: 'flex-start',
    maxWidth: '100%',
    maxHeight: 96,
    objectFit: 'contain',
    padding: theme.spacing(0.5),
    // Xadrez discreto atras da miniatura: sem ele, um PNG transparente branco
    // fica invisivel no tema escuro e o usuario acha que o upload falhou.
    background: `repeating-conic-gradient(${theme.colors.background.secondary} 0% 25%, ${theme.colors.background.primary} 0% 50%) 50% / 12px 12px`,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  }),
  actions: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  error: css({
    color: theme.colors.error.text,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
