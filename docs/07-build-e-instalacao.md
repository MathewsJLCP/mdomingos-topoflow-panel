# 07 — Build e instalação

## Gerar o pacote

```bash
npm ci                # instala exatamente o que está no package-lock
npm run build         # webpack em modo produção -> dist/
```

`dist/` **é** o plugin. Nada mais precisa ser copiado para lá: o webpack já leva
`plugin.json`, `README.md` (o de `src/`, que é o exibido na página do plugin),
`CHANGELOG.md`, `LICENSE` e os assets de ícone, e substitui `%VERSION%` e
`%TODAY%` no `plugin.json` pelo que está no `package.json`.

Conteúdo típico (v1.1.0 — 88 arquivos, ~3 MB descompactado, 1,2 MB zipado):

```
dist/
├── module.js         436 KB   o bundle
├── module.js.map     1.9 MB   sourcemap (útil para depurar em produção)
├── plugin.json       metadados, já com version e updated preenchidos
├── README.md  CHANGELOG.md  LICENSE  LICENSE.txt
├── img/logo.svg  img/logo-small.svg
└── *.png             71 assets dos packs de ícone
```

### Empacotar

O zip precisa ter **uma pasta com o nome do id do plugin na raiz**:

```bash
mkdir -p releases && cd dist && zip -qr ../releases/mdomingos-topoflow-panel-1.1.0.zip . && cd ..
```

Se a sua versão do `zip` não criar a pasta wrapper, faça o staging explícito:

```bash
mkdir -p /tmp/pkg/mdomingos-topoflow-panel releases
cp -r dist/. /tmp/pkg/mdomingos-topoflow-panel/
(cd /tmp/pkg && zip -qr "$OLDPWD/releases/mdomingos-topoflow-panel-1.1.0.zip" mdomingos-topoflow-panel)
sha1sum releases/mdomingos-topoflow-panel-1.1.0.zip
```

O resultado tem que abrir assim:

```
mdomingos-topoflow-panel/
├── module.js
├── plugin.json
└── …
```

> **Errado:** o zip com os arquivos soltos na raiz. O Grafana descompacta e não
> encontra o diretório do plugin.

### O que **não** entra no pacote

Nada disso é copiado pelo webpack, e não deve ser adicionado à mão: `src/`,
`node_modules/`, `docs/`, `temp/`, `tests/`, `provisioning/`, `.config/`,
`playwright*`, `jest*`, `*.test.*`, configs de raiz. O pacote é só `dist/`.

Se quiser um pacote mais enxuto, o único candidato a sair é `module.js.map`
(1.9 MB). Ele não é necessário para o plugin funcionar — só para depurar com
stack traces legíveis. Mantê-lo é o padrão do `@grafana/create-plugin`.

## Instalar num Grafana real

O plugin **não é assinado**. Grafana recusa plugins sem assinatura por padrão,
então a instalação tem dois passos: copiar e liberar.

### 1. Copiar para o diretório de plugins

O caminho depende de como o Grafana foi instalado (`plugins` em
`[paths]` do `grafana.ini`):

| Instalação | Caminho padrão |
| --- | --- |
| pacote `.deb`/`.rpm` | `/var/lib/grafana/plugins` |
| binário/tarball | `<grafana>/data/plugins` |
| Docker | volume montado em `/var/lib/grafana/plugins` |
| macOS (Homebrew) | `/opt/homebrew/var/lib/grafana/plugins` |

```bash
sudo unzip mdomingos-topoflow-panel-1.1.0.zip -d /var/lib/grafana/plugins/
sudo chown -R grafana:grafana /var/lib/grafana/plugins/mdomingos-topoflow-panel
```

### 2. Liberar o carregamento sem assinatura

Em `grafana.ini` (ou `custom.ini`):

```ini
[plugins]
allow_loading_unsigned_plugins = mdomingos-topoflow-panel
```

Por variável de ambiente (Docker, systemd):

```
GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=mdomingos-topoflow-panel
```

> Liste **apenas os ids necessários**. Um valor curinga desliga a verificação
> para tudo.

### 3. Reiniciar o Grafana

```bash
sudo systemctl restart grafana-server     # ou: docker restart <container>
```

Reiniciar é obrigatório: o `plugin.json` só é lido na inicialização.

### 4. Conferir

```bash
curl -s http://localhost:3000/api/plugins?embedded=0 | grep -o 'mdomingos-topoflow-panel'
```

Ou pela interface: **Administration → Plugins**, filtrando por *Panel*. Deve
aparecer "TopoFlow" com o aviso de plugin sem assinatura.

Se não aparecer, o log diz o motivo:

```bash
sudo journalctl -u grafana-server -n 100 | grep -i plugin
# ou
docker logs <container> 2>&1 | grep -i plugin
```

| Mensagem no log | Causa |
| --- | --- |
| `plugin ... is unsigned` | falta o `allow_loading_unsigned_plugins` |
| `plugin not found` / nada no log | o zip foi descompactado sem a pasta wrapper |
| `plugin requires Grafana version >= …` | Grafana abaixo de 12.3.0 |
| erro de permissão | o dono do diretório não é o usuário do Grafana |

## Docker: montar o plugin

```yaml
services:
  grafana:
    image: grafana/grafana-enterprise:13.1.0
    ports: ['3000:3000']
    volumes:
      - ./mdomingos-topoflow-panel:/var/lib/grafana/plugins/mdomingos-topoflow-panel
    environment:
      GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS: mdomingos-topoflow-panel
```

É o que o `docker-compose.yaml` do repositório já faz, montando o `dist/`
diretamente — o ambiente de desenvolvimento não precisa de zip nem de cópia.

## Atualizar uma instalação existente

1. Substitua o **conteúdo** da pasta `mdomingos-topoflow-panel/` (não crie uma
   segunda pasta com outro nome — o id é o que importa).
2. Reinicie o Grafana.
3. Limpe o cache do navegador se o painel não mudar: o `module.js` é servido com
   cache agressivo.

Dashboards existentes continuam funcionando: o formato salvo (`schemaVersion: 1`)
não mudou, e todo campo novo entrou de forma retrocompatível
(ver [doc 02](02-modelo-e-persistencia.md)). Leia as **Notas de atualização** do
`CHANGELOG.md` antes de subir uma versão nova.

## Assinatura (quando for distribuir)

Sem assinatura o plugin funciona, mas exige a liberação manual em cada
instalação. Para distribuir de verdade:

```bash
export GRAFANA_ACCESS_POLICY_TOKEN=<token com a permissão de publicar plugins>
npm run sign        # @grafana/sign-plugin, gera dist/MANIFEST.txt
```

Antes disso:

- a **primeira parte do id** (`mdomingos-`) tem que bater com o slug da conta
  Grafana Cloud;
- decida o nível de assinatura (*private*, *community*, *commercial*) —
  para uso interno, **private**, listando os domínios das instâncias;
- desde a v1.4 não há asset de terceiro com licença pendente: os ícones são
  arte própria (o catálogo SVG do mockup) e as fontes IBM Plex são OFL. Ver
  [doc 09](09-pendencias-e-roadmap.md).

O workflow de release em `.github/workflows/` já faz isso a partir de uma tag,
desde que o segredo esteja configurado no repositório.

## Versionar

A versão exibida sai do `package.json` (`%VERSION%` é substituído no build).

```bash
npm version <major|minor|patch>
git push origin <branch> --follow-tags
```

Atualize o `CHANGELOG.md` na mesma mudança — ele vai dentro do pacote e é o que
o operador lê antes de atualizar.
