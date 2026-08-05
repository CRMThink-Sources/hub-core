---
category: config
audience: dev
stub: true
summary: Provider sem rotina de renovação de token configurada.
---
# thinkanalise.token.no_refresher

## Direção (dev)
- **Causa provável:** O token expirou mas o provider não tem rotina de refresh registrada no CRMThink.
- **Investigar:** Ler a linha de log com o `traceKey` e conferir o mapeamento de refreshers por provider; provider OAuth deveria ter refresher associado.
