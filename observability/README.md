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

**Onde achar no Grafana:** menu **Dashboards** → pasta **HubThink** → **HubThink - Logs / fila / HTTP** (não fica em “General” por padrão).

## Por que o deploy não mostrou o dashboard?

1. **Pasta errada na UI** — o provisionamento coloca o painel na pasta **HubThink**.
2. **Grafana já estava rodando** — o carregamento de dashboards por arquivo é aplicado de forma confiável no **start** do container. O CI agora faz `docker compose ... up -d --force-recreate grafana` após o deploy.
3. **Arquivos não foram para a VPS** — no log do job deve aparecer `ls -la observability/grafana/provisioning/dashboards/json/`. Se estiver vazio ou `MISSING`, o `scp` não trouxe a árvore `observability/` ou o branch deployado não tinha esses arquivos commitados.
4. **Erro no JSON** — veja `docker logs hubthink-grafana | grep -i provision` na VPS.

### Corrigir manualmente na VPS

```bash
cd ~/hubthink-observability
ls -la observability/grafana/provisioning/dashboards/json/
docker compose -p hubthink-observability -f docker-compose.observability.yml up -d --force-recreate grafana
docker logs hubthink-grafana 2>&1 | tail -n 50
```

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
