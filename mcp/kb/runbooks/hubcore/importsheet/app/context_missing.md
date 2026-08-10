---
category: internal
audience: dev
stub: true
summary: Requisição chegou sem appId/domainId no contexto do app.
---
# importsheet.app.context_missing

## Direção (dev)
- **Causa provável:** A requisição chegou sem `appId`/`domainId` no contexto do app.
- **Investigar:** Middleware/token do app; provável front não enviando o contexto na requisição.
