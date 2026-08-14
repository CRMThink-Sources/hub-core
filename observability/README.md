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

## Labels Loki (`app`, `source`)

O Promtail extrai dos logs JSON da API/worker:

- **`app`**: `thinkzap`, `thinkanalise` ou `shared` (HTTP e handlers)
- **`source`**: `z-api` ou `bitrix` (fila, worker e webhooks ThinkZap)

Logs do front (não JSON) não recebem esses labels. Logs **anteriores ao deploy** da instrumentação não têm `app`/`source` até expirarem no retention do Loki.

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
# ThinkZap (API + worker + webhooks)
{job="docker", app="thinkzap"}

# ThinkAnalise (só API)
{job="docker", app="thinkanalise"}

# Worker Z-API
{job="docker", container=~"hubthink-worker.*", app="thinkzap", source="z-api"}

# Worker Bitrix
{job="docker", container=~"hubthink-worker.*", app="thinkzap", source="bitrix"}

# Fallback sem label (logs antigos)
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

- `app`, `source`, `messageId`, `instanceId`, `jobId`, `path`, `level`

## Deploy na VPS

Ordem recomendada após release:

1. Deploy API + worker (novos campos `app` / `source` no JSON).
2. Deploy observability (Promtail + Grafana). O CI recria `grafana` e `promtail` com `--force-recreate`.

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
