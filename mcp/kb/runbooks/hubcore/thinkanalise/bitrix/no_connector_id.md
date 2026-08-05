---
category: integration
audience: dev
stub: true
summary: O Bitrix24 não retornou o id do conector ao criar.
---
# thinkanalise.bitrix.no_connector_id

## Direção (dev)
- **Causa provável:** A criação via `biconnector.connector.*` respondeu sem o id do conector esperado.
- **Investigar:** Ler a linha de log com o `traceKey` e inspecionar o corpo da resposta do Bitrix — o fluxo depende desse id nos passos seguintes (source/dataset).
