# Observabilidade de Logs (Grafana + Loki + Promtail)

## Subir stack

```bash
docker compose -f docker-compose.observability.yml up -d
```

Grafana: `http://localhost:3003`
Usuario: `admin`
Senha: `admin`

## Dashboards (provisionados)

Ao subir o Grafana, a pasta **HubThink** contém o dashboard **HubThink - Logs / fila / HTTP**:

- volume de log por container (`api`, `worker`, `front`, staging e produção);
- eventos **Z-API** recebidos e **jobs enfileirados** (texto dos seus logs estruturados);
- ciclo do worker (**ativo**, **completed**, **failed**) e um stat de falhas em 15 min;
- série de requests **HTTP request completed** na API;
- painéis de **logs** para API e worker + painel combinado de erros.

O JSON fica versionado em `observability/grafana/provisioning/dashboards/json/hubthink-logs-overview.json` (você pode editar e versionar mudanças). **Allow UI updates** está ligado para poder ajustar no Grafana e exportar depois para o arquivo, se preferir.

## Logs coletados

O Promtail coleta logs de containers Docker com os nomes:

- `hubthink-api`
- `hubthink-api-staging`
- `hubthink-worker`
- `hubthink-worker-staging`
- `hubthink-front`
- `hubthink-front-staging`

## Query inicial no Explore (Grafana)

```logql
{job="docker", container="hubthink-worker-staging"}
```

## Campos uteis para filtro

Como os logs da API/worker estao em JSON, voce pode filtrar por:

- `messageId`
- `instanceId`
- `jobId`
- `source`
- `type`
- `level`
