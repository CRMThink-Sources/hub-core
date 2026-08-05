---
category: validation
audience: dev
stub: true
summary: O callback do BI chegou sem os dados de conexão necessários.
---
# thinkanalise.callback.connection_missing

## Direção (dev)
- **Causa provável:** Um callback do BI Builder (check/data/tables/describe) chegou sem os dados de conexão esperados.
- **Investigar:** Ler a linha de log com o `traceKey` e conferir o payload do callback do Bitrix; validar o que o BI Builder deveria enviar como conexão.
