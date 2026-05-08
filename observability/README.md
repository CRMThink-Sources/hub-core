# Observabilidade de Logs (Grafana + Loki + Promtail)

## Subir stack

```bash
docker compose -f docker-compose.observability.yml up -d
```

Grafana: `http://localhost:3003`
Usuario: `admin`
Senha: `admin`

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
