---
category: validation
audience: dev
stub: true
summary: A sessão não trouxe a instalação (appId).
---
# gptmaker.app.context_missing

## Direção (dev)
- **Causa provável:** O app foi aberto fora do iframe do portal, ou o JWT da sessão expirou/veio sem `appId`.
- **Investigar:** Conferir na linha de log se `domain` e `appId` chegaram. Sem `appId` não há como resolver a posse do agente, e a requisição é recusada antes de qualquer chamada ao GPT Maker.
