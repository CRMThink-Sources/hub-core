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
