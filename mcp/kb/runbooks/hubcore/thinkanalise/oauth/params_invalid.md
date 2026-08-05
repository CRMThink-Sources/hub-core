---
category: validation
audience: dev
stub: true
summary: Parâmetros do início do OAuth inválidos (falta sourceId ou connectorId+title).
---
# thinkanalise.oauth.params_invalid

## Direção (dev)
- **Causa provável:** O início do OAuth foi chamado sem os parâmetros necessários (falta `sourceId`, ou falta o par `connectorId` + `title`).
- **Investigar:** Ler a linha de log com o `traceKey` e conferir os parâmetros recebidos na rota de início do OAuth.
