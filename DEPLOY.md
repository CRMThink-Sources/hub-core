# Deploy - HubThink Core

## Arquitetura

```
Push develop  ──►  CI (lint/build)  ──►  Docker build  ──►  GHCR (:staging)  ──►  VPS (staging)
Push main     ──►  CI (lint/build)  ──►  Docker build  ──►  GHCR (:latest)   ──►  VPS (production)
```

## 1. Configurar Secrets no GitHub

Vá em **Settings → Environments** no repositório e crie dois environments: `staging` e `production`.

Em cada environment, adicione os seguintes secrets:

| Secret        | Descrição                                  | Exemplo                       |
| ------------- | ------------------------------------------ | ----------------------------- |
| `VPS_HOST`    | IP ou domínio da VPS                       | `142.93.xxx.xxx`              |
| `VPS_USER`    | Usuário SSH na VPS                         | `deploy`                      |
| `VPS_SSH_KEY` | Chave privada SSH (conteúdo do id_ed25519) | `-----BEGIN OPENSSH...`       |
| `ENV_API`     | Conteúdo completo do `.env` da API         | `PORT=4000\nDATABASE_URL=...` |
| `ENV_FRONT`   | Conteúdo completo do `.env` do front       | `NEXT_PUBLIC_API_URL=...`     |
| `ENV_MCP`     | Conteúdo completo do `.env` do MCP         | `PORT=3200\nMCP_JWT_SECRET=`  |

> `ENV_MCP` **precisa** de `MCP_JWT_SECRET`, `MCP_OAUTH_ISSUER_URL` e `MCP_PUBLIC_URL` —
> sem os três o server aborta o boot (`mcp/src/index.ts`) e o container entra em crash loop.
> Mantenha `PORT=3200`: os composes mapeiam a porta do host pra 3200 dentro do container.

> `ENV_FRONT` pode trazer `NEXT_PUBLIC_THINKZAP_MARKET_URL` (página do app no Bitrix24
> Market) e `NEXT_PUBLIC_THINKZAP_SALES_WHATSAPP` (WhatsApp do comercial, com DDI) — são
> os CTAs da LP pública `/lp/thinkzap`. Vazias, os botões somem. Por serem `NEXT_PUBLIC_*`,
> trocar o valor exige rebuildar a imagem do front.

## 2. Preparar a VPS

Execute estes comandos na VPS como root:

```bash
# Criar usuário de deploy
adduser deploy
usermod -aG docker deploy

# Instalar Docker (se ainda não tem)
curl -fsSL https://get.docker.com | sh
systemctl enable docker

# Configurar chave SSH
su - deploy
mkdir -p ~/.ssh
chmod 700 ~/.ssh
# Cole a chave PÚBLICA no authorized_keys:
echo "ssh-ed25519 AAAA..." >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

## 3. Gerar par de chaves SSH

No seu computador local:

```bash
ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/hubthink_deploy
```

- **Chave pública** (`hubthink_deploy.pub`) → colocar no `~/.ssh/authorized_keys` da VPS
- **Chave privada** (`hubthink_deploy`) → colocar no secret `VPS_SSH_KEY` do GitHub

## 4. Como funciona

### Branches

| Branch    | Ambiente   | Tag Docker | Portas na VPS                   |
| --------- | ---------- | ---------- | ------------------------------- |
| `develop` | staging    | `:staging` | front:3001, api:4001, mcp:3201  |
| `main`    | production | `:latest`  | front:3002, api:4000, mcp:3200  |

O MCP precisa de HTTPS público pro connector do claude.ai: aponte um subdomínio
(ex.: `mcp.<dominio>`) no reverse proxy da VPS pra `127.0.0.1:3200`, e use essa URL
em `MCP_PUBLIC_URL`. Isso é config de nginx na VPS, não faz parte do workflow.

### Fluxo de trabalho

1. Desenvolva em feature branches
2. Abra PR para `develop` → CI roda lint e build
3. Merge em `develop` → Deploy automático para staging
4. Quando staging estiver OK, abra PR de `develop` → `main`
5. Merge em `main` → Deploy automático para produção

### Comandos úteis na VPS

```bash
# Ver status dos containers
cd ~/hubthink
docker compose ps

# Ver logs em tempo real
docker compose logs -f api
docker compose logs -f front

# Restart manual
docker compose restart api

# Deploy manual (pull + recreate)
docker compose pull && docker compose up -d
```

### Fila de envio do widget — o que conferir depois do deploy

O provisionamento é automático: o CI copia os compose files e roda `up -d
--remove-orphans`, então serviço novo no arquivo sobe junto. O que vale conferir é se o
consumidor da fila de envio do widget está de pé — sem ele, a API continua aceitando
mensagem e respondendo `202`, o operador vê "Mensagem na fila", e nada é entregue.
Nenhum erro aparece em lugar nenhum.

```bash
docker compose logs worker-widget-outbound | grep "widget outbound worker is ready"
```

Se houver suspeita de fila parada:

```sql
SELECT status, COUNT(*) FROM core_thinkerszap_widget_outbox GROUP BY status;
```

- `PENDING` antigo → fila sem consumidor no período. Drena sozinho quando o worker sobe.
- `UNKNOWN` → processo morreu durante a chamada ao provider. **Não é reenviado de
  propósito** — pode ter sido entregue. O operador já foi avisado na timeline para
  conferir antes de reenviar.

### Isolamento das filas entre ambientes (`QUEUE_PREFIX`)

As chaves do BullMQ são prefixadas por `QUEUE_PREFIX` (default `bull`, o mesmo do
BullMQ). Ambientes que dividem host **e** índice de DB do Redis sem prefixos distintos
dividem literalmente a mesma fila `bull:<nome>:*`, e as duas direções machucam:

- worker de staging consome mensagem de cliente e queima as tentativas dela contra o
  banco de homologação — os sintomas são `App not found`, `Context not found` e
  `Instance not found` para portal real, no log do container de staging;
- worker de produção processa job enfileirado por staging, com credencial de produção —
  na fila `thinkzap-widget-outbound` isso é mensagem real no WhatsApp de contato real.

Configuração: produção **sem** a variável (segue em `bull`); staging com
`QUEUE_PREFIX=bull-staging`. `src/queue/queue-prefix.guard.test.ts` falha se alguma
construção de `Queue`/`Worker` deixar de receber `bullBaseOptions`, que é o único lugar
onde conexão e prefixo são decididos.

**Trocar o valor troca de fila.** O que estiver enfileirado no prefixo antigo fica órfão
— nem processado, nem visível no Bull Board novo. Ordem para virar:

1. Pare os produtores do ambiente (API e webhooks) ou aceite a perda do que entrar.
2. Espere a fila drenar: `waiting` e `delayed` em zero no Bull Board.
3. Só então mude a variável e suba os serviços.

Job repeatable (o tick do ImportSheet) também vive sob o prefixo: ele é re-registrado no
boot do worker, então volta sozinho no prefixo novo.

O prefixo isola **só o BullMQ**. Chaves de aplicação no mesmo Redis — cache do `botId`
(`thinkzap:bot:*`), lock de documento do Clicksign — não têm prefixo de ambiente, então
mantenha índices de DB distintos no `REDIS_URL` (`/0` produção, `/1` staging/homologação).

Não é convenção opcional: produção e homologação usam o **mesmo portal Bitrix**, logo a
mesma SPA de planos (1138), e o que difere entre os ambientes é o price id — cada um lê
o campo da conta Stripe dele. As chaves de `payments` que carregam price id (plano e
assinatura, que embute o plano) são escopadas por ambiente do gateway justamente porque
o índice de DB pode estar compartilhado por engano; o índice separado é a segunda
camada. Sem nenhuma das duas, produção serve a entrada gravada pela homologação e uma
assinatura paga aparece como trial — `isTrialSubscription` deriva "é trial" da ausência
de price id.

### Robô de template do Bizproc — ordem de deploy e registro

O robô de envio de template (`thinkzap_template_robot`) é registrado no portal com um
`HANDLER` (webhook na API) e um `PLACEMENT_HANDLER` (tela de configuração no front).
Registrar o robô antes de as duas rotas existirem cria automação que só falha no
primeiro disparo, então a ordem importa:

1. **Env primeiro.** `BITRIX_TEMPLATE_ROBOT_HANDLER_URL` e
   `BITRIX_TEMPLATE_ROBOT_PLACEMENT_URL` nos secrets do ambiente. Sem `HANDLER_URL` o
   registro é no-op — deployar sem as variáveis é seguro, o robô simplesmente não
   aparece.
2. **API e front depois.** O webhook (`POST /api/thinkzap/webhooks/bitrix/template-robot`)
   e a tela (`/bitrix/bizproc/template`) precisam estar no ar **antes** de qualquer
   portal registrar o robô.
3. **Registro nos portais.** Instalação nova registra sozinha. Portal já instalado
   registra por `POST /api/portal/apps/:appId/bizproc-robot` (botão "Registrar robô" no
   admin) — a chamada garante os dois robôs e devolve `result` (envio livre) e
   `templateResult` (template).

Conferir depois: o robô aparece na lista de automação do portal, e a tela abre no
slider de configuração. Se a tela não abrir, o Bitrix cai no formulário nativo sobre as
mesmas propriedades — a automação continua configurável, só sem a lista de templates.

**Rollback:** `bizproc.robot.delete` do robô de template pelo mesmo endpoint de
remoção do admin (`DELETE /api/portal/apps/:appId/bizproc-robot`, que remove os dois).
O robô de envio livre e o envio do widget não são tocados. Intenções já no outbox
seguem sendo entregues — remover o robô impede disparos novos, não cancela os aceitos.

### Provedor de mensagem da campanha de SMS — escopo `messageservice` (pendência externa)

O provedor de mensagem (`messageservice.sender.add`) é o que faz a linha de WhatsApp
aparecer em **Marketing → Campanha de SMS** no Bitrix do cliente. Toda chamada de
registro depende do escopo `messageservice` estar **publicado no manifesto do app no
Marketplace** — e de o portal reautorizar o app depois disso.

**Enquanto o escopo não estiver publicado**, todo registro responde erro de escopo e o
teste end-to-end fica bloqueado. É passo externo, fora deste repositório.

Ordem de deploy, pelo mesmo motivo do robô de template:

1. **Escopo primeiro.** Publicar o manifesto com `messageservice`; portais já
   instalados só passam a conceder o escopo depois de reautorizar.
2. **Deploy com `BITRIX_SMS_HANDLER_URL` vazia.** Todo registro vira `skipped`, nenhuma
   chamada ao Bitrix, nada muda para nenhum cliente.
3. **Preencher `BITRIX_SMS_HANDLER_URL`** apontando para
   `<API>/api/thinkzap/webhooks/bitrix/sms-provider`, já no ar.
4. **Registrar por linha** no portal admin
   (`POST /api/portal/apps/:appId/thinkzap-lines/:subscriptionItemId/sms-provider`).

**Rollback:** remover o sender pela ação do admin (`DELETE` na mesma rota). Esvaziar
`BITRIX_SMS_HANDLER_URL` impede registros novos, mas **não** tira da tela do cliente os
provedores já registrados — só a remoção do sender faz isso.

## Desenvolvimento local

- [docs/DEV-WORKERS.md](docs/DEV-WORKERS.md) — **workers e filas**. O compose de dev não
  sobe worker nenhum; cada fila precisa do processo rodando à mão, e esquecer não gera
  erro. É a causa mais comum de "enviei e não aconteceu nada" localmente.
- [docs/DEV-BITRIX.md](docs/DEV-BITRIX.md) — widget de áudio: túneis,
  `BITRIX_IFRAME_AUDIO_URL`, erro `Unexpected token '<'` e proxy `/api` no `next dev`.
