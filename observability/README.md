# Observabilidade de Logs (Grafana + Loki + Promtail)

## Subir stack

```bash
docker compose -f docker-compose.observability.yml up -d
```

Grafana: `http://localhost:3003`
Usuario: `admin`
Senha: `admin`

## Dashboards (provisionados)

Ao subir o Grafana, a pasta **HubThink** contém:

| Dashboard                         | UID                           | Conteúdo                                         |
| --------------------------------- | ----------------------------- | ------------------------------------------------ |
| **HubThink - Logs / fila / HTTP** | `hubthink-logs-overview`      | Visão geral por container + links para os demais |
| **HubThink - ThinkZap**           | `hubthink-logs-thinkzap`      | API, fila e worker ThinkZap (`app="thinkzap"`)   |
| **HubThink - ThinkAnalise**       | `hubthink-logs-thinkanalise`  | API ThinkAnalise (`app="thinkanalise"`)          |
| **HubThink - Worker Z-API**       | `hubthink-logs-worker-zapi`   | Worker com `source="z-api"`                      |
| **HubThink - Worker Bitrix**      | `hubthink-logs-worker-bitrix` | Worker com `source="bitrix"`                     |

JSONs em `observability/grafana/provisioning/dashboards/json/`. **Allow UI updates** está ligado para ajustar no Grafana e exportar de volta ao repo, se preferir.

**Onde achar no Grafana:** menu **Dashboards** → pasta **HubThink**.

## Labels Loki (`app`, `source`, `env`, `level`)

O Promtail extrai/deriva quatro labels de baixa cardinalidade — o que se filtra e
agrupa rápido, sem escanear o corpo da linha:

- **`app`**: `thinkzap`, `thinkanalise`, `importsheet`, `clicksign` ou `shared`
  (extraído do JSON — HTTP e handlers)
- **`source`**: `z-api` ou `bitrix` (extraído do JSON — fila, worker e webhooks
  ThinkZap)
- **`env`**: `production` ou `staging` — **derivado do nome do container**
  (sufixo `-staging`), não de `NODE_ENV`. Os dois ambientes setam `NODE_ENV`
  de forma diferente entre si (hoje: `production` em produção, `development`
  em staging), então o nome do container é a fonte estável.
- **`level`**: `trace`/`debug`/`info`/`warn`/`error`/`fatal` — Pino loga o nível
  como número (`10`–`60`); o Promtail traduz pro nome antes de indexar.

Logs do front (não JSON) não recebem `app`/`source`/`level`, mas recebem `env`
(deriva só do nome do container). Logs **anteriores a este deploy** não têm
`env`/`level` até expirarem no retention do Loki.

## Campo `event`: nome estável por marco de ciclo de vida

Cada worker escreve a mensagem humana (`msg`) do jeito que quiser — é o que aparece
lido por gente. O problema é usar essa mensagem pra **filtrar/contar** num
dashboard: `thinkzap-inbound.worker.ts` loga `'Worker job failed'`,
`thinkzap-widget-outbound.worker.ts` loga `'Widget outbound job failed'` — um
painel que filtra por uma das duas string perde a outra.

`event` resolve isso: um campo estruturado, de baixo nível de cardinalidade,
**adicionado ao lado** da mensagem (nunca a substitui), convenção
`<domínio>.<entidade>.<ação>` — mesmo estilo do `errorCode`
(`thinkzap.message.open_channel_failed`). Valores hoje:

| Evento | Quando |
| --- | --- |
| `http.request` | toda resposta HTTP da API |
| `worker.job.active` | BullMQ pegou o job pra processar |
| `worker.job.completed` | job terminou com sucesso |
| `worker.job.failed` | job terminou com erro (pode retentar) |
| `worker.job.stalled` | job travou e vai ser reprocessado |
| `worker.ready` / `worker.error` | ciclo de vida do processo worker (não de um job) |
| `queue.job.enqueued` | algo foi colocado numa fila BullMQ |
| `webhook.received` | webhook de provider recebido (hoje: Z-API) |

Não é pra instrumentar todo log do sistema — só marcos que valem
dashboard/alerta. Novos call sites que sirvam esse propósito devem seguir a
convenção acima.

## Logs coletados

O Promtail coleta por **padrão de nome**, não por lista fixa: o regex é
`/hubthink-(api|worker|front).*`, com ou sem sufixo `-staging`.

Na prática, hoje:

| Container                          | Conteúdo                                            |
| ---------------------------------- | --------------------------------------------------- |
| `hubthink-api`                     | API HTTP e webhooks                                  |
| `hubthink-worker`                  | Fila de inbound do ThinkZap                          |
| `hubthink-worker-widget-outbound`  | **Entrega da mensagem enviada pelo widget** e canal aberto |
| `hubthink-worker-spa-provisioning` | Provisionamento de linha na SPA                      |
| `hubthink-worker-spa-resource-sync`| Sincronização item ↔ recurso                        |
| `hubthink-worker-clicksign`        | Fila do Clicksign                                    |
| `hubthink-front`                   | Next.js (logs não-JSON, sem `app`/`source`)          |

> **Ao criar um worker novo, o nome do container precisa começar com `hubthink-worker`.**
> Fora dessa convenção, os logs não são coletados e **nada avisa** — não há erro em
> lugar nenhum, o container simplesmente não aparece no Loki.

## Queries no Explore (Grafana)

```logql
# ThinkZap em produção (API + worker + webhooks)
{job="docker", env="production", app="thinkzap"}

# ThinkAnalise em staging (só API)
{job="docker", env="staging", app="thinkanalise"}

# Worker Z-API
{job="docker", env="production", container=~"hubthink-worker.*", app="thinkzap", source="z-api"}

# Worker Bitrix
{job="docker", env="production", container=~"hubthink-worker.*", app="thinkzap", source="bitrix"}

# Só erro/fatal, qualquer app, em produção
{job="docker", env="production", level=~"error|fatal"}

# Fallback sem label (logs antigos, antes de env/level existirem)
{job="docker", container="hubthink-api-staging"} |= "/api/thinkzap"
```

## Diagnosticar um envio pelo widget

O envio de texto pelo widget é **enfileirado**: a API responde `202` e a entrega
acontece no worker. Quando alguém pergunta "mandei e não chegou", a investigação é
sobre o ciclo de vida do job, não sobre a requisição.

O `jobId` é determinístico (`widget-send:<outboxId>`), então ele devolve a história
inteira de **uma** mensagem:

```logql
# Tudo que aconteceu com uma mensagem
{job="docker", container=~"hubthink-worker-widget-outbound.*"}
  | json | jobId = "widget-send:<outboxId>"
```

A sequência esperada é `started` → `Despachando intenção` → `entregue ao provider` →
`completed`. O que falta diz o que houve:

| Sintoma no log                              | O que aconteceu                                        |
| ------------------------------------------- | ------------------------------------------------------ |
| Nenhuma linha                                | Job nunca chegou ao worker — worker parado ou não enfileirado |
| `started` sem `completed`/`failed`           | Travou no meio; procure `stalled`                      |
| `stalled: true`                              | Processo morreu ou passou do lock; vira `UNKNOWN` no outbox |
| `failed` com `willRetry: true`               | Vai tentar de novo — **não** é mensagem perdida        |
| `failed` com `willRetry: false`              | Desistiu; operador avisado na timeline                 |
| `waitMs` alto                                | Fila represada — problema nosso (worker sem vazão)     |
| `runMs` alto                                 | Provider ou Bitrix lentos — problema de terceiro       |
| `alreadyDelivered: true`                     | Retomada de efeitos colaterais; o provider **não** foi chamado de novo |

```logql
# Envios que desistiram (operador foi avisado na timeline)
{job="docker", app="thinkzap"} | json | errorCode = "thinkzap.message.widget_send_exhausted"

# Entrega indeterminada — não é reenviada de propósito
{job="docker", app="thinkzap"} | json | errorCode = "thinkzap.message.widget_send_unknown"

# Jobs travados
{job="docker", container=~"hubthink-worker-widget-outbound.*"} | json | stalled = "true"

# Worker sem conseguir falar com o Redis
{job="docker", container=~"hubthink-worker-widget-outbound.*"} |= "Widget outbound worker error"
```

Se o log não tiver nada, o estado está no banco:

```sql
SELECT status, COUNT(*) FROM core_thinkerszap_widget_outbox GROUP BY status;
```

### "O widget disse que enviou e não chegou no telefone"

O passo que separa **nosso problema** do problema do provider é descobrir se a Z-API
aceitou o envio e com qual id:

```logql
{job="docker", app="thinkzap"} | json | operation =~ "send.*" | phone = "5511999999999"
```

A linha `Z-API aceitou o envio` traz `zaapId`, `messageId` e `zApiId`.

**Aceite não é entrega.** Ele significa só "recebi a ordem de enviar"; a entrega ao
aparelho é assíncrona e chega depois pelo `MessageStatusCallback`. Então:

| O que o log mostra                          | Conclusão                                              |
| ------------------------------------------- | ------------------------------------------------------ |
| Nenhuma linha `Z-API aceitou o envio`        | A chamada nunca aconteceu ou falhou — **problema nosso** |
| Aceitou, com `messageId`                     | Saiu daqui. Consultar o `messageId` no painel da Z-API — **problema do provider ou do número** |
| Aceitou, com `missingMessageId: true`        | `200` sem id: a Z-API respondeu de forma inesperada. O `providerMessageId` vai nulo na persistência |

Causas comuns quando a Z-API aceita e o aparelho não recebe: número sem WhatsApp,
número com o 9º dígito errado, ou instância desconectada logo após o aceite.

### Logs de provider (Z-API e HubMessage)

Os dois clients são instrumentados por interceptor de axios, então **toda** chamada é
registrada — não só envio.

```logql
# Toda falha de provider, com o corpo da resposta (é onde está o motivo real)
{job="docker", app="thinkzap"} | json | provider =~ "ZAPI|HUBMESSAGE" |= "Provider falhou"

# Só HubMessage (WhatsApp Oficial)
{job="docker", app="thinkzap"} | json | provider = "HUBMESSAGE"
```

Campos:

| Campo        | Para que serve                                                        |
| ------------ | --------------------------------------------------------------------- |
| `status`     | Código HTTP. Ausente = não houve resposta                              |
| `response`   | **Corpo da resposta** — onde a Z-API diz "número não existe no WhatsApp" e a HubMessage diz "fora da janela de 24h" |
| `noResponse` | `true` = timeout/DNS/conexão. Num envio, é a diferença entre recusado e **indeterminado** |
| `durationMs` | Latência da chamada                                                   |
| `url`        | Caminho **com o token mascarado**                                      |

Sucesso sai em `debug` para não gerar uma linha por chamada no volume normal; **falha
sai sempre em `error`**. Para investigar a fundo, suba `LOG_LEVEL` para `debug` e as
requisições bem-sucedidas passam a aparecer com corpo de resposta e duração.

> **Credencial nunca é logada.** A Z-API põe o token no caminho da URL e ele é mascarado
> (`/token/***`); headers não são registrados em nenhum dos dois. Corpo de requisição
> também não — é a mensagem do cliente final e, em mídia, base64 de dezenas de MB; só o
> tamanho (`requestBytes`) entra. Resposta acima de 2000 chars vira o tamanho, para não
> despejar QR code no Loki.

### Qual caminho entregou a mensagem?

Nem todo envio do widget passa pela fila, e isso muda onde procurar:

```logql
# Entregue dentro do request (anexo e template)
{job="docker", app="thinkzap"} | json | deliveryPath = "sync"
```

- Achou `deliveryPath: sync` → foi anexo ou template. **Não existe job de envio**, e o
  único job na fila é o de abertura de conversa.
- Não achou → foi texto, entregue pelo worker. Procure o job `widget-send:<outboxId>`.

Um job de `open-channel` sozinho, sem job de envio, significa caminho síncrono. A
primeira linha dele traz o `providerMessageId` para continuar a investigação acima.

## Campos úteis para filtro (JSON)

- `event`, `messageId`, `instanceId`, `jobId`, `path`, `errorCode`, `traceKey`,
  `domain`, `appId`
- `app`, `source`, `env`, `level` já são **labels** (ver seção acima) — filtram sem
  precisar de `| json`.

## Deploy na VPS

Ordem recomendada após release:

1. Deploy API + worker (campos `app` / `source` / `event` no JSON).
2. Deploy observability (Promtail + Grafana). O CI recria `grafana` e `promtail` com `--force-recreate` — é este passo que ativa as labels `env` e `level` e os dashboards com a variável `$env`.

### Corrigir manualmente na VPS

```bash
cd ~/hubthink-observability
ls -la observability/grafana/provisioning/dashboards/json/
docker compose -p hubthink-observability -f docker-compose.observability.yml up -d --force-recreate grafana promtail
docker logs hubthink-grafana 2>&1 | tail -n 50
```

### Por que o dashboard não aparece?

1. Pasta errada na UI — procure em **HubThink**, não em General.
2. Grafana já estava rodando — use `--force-recreate grafana` após copiar os JSONs.
3. Arquivos não chegaram na VPS — confira o `scp` no job de CI.
