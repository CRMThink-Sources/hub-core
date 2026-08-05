---
category: integration
audience: dev
stub: true
summary: Não há registro de token Google para o app ao pedir o access token.
---
# importsheet.google.connection_not_found

## Direção (dev)
- **Causa provável:** Ao solicitar o access token não existe registro de token Google para o app — deveria ter virado `importsheet.google.auth_required` na borda.
- **Investigar:** Por que o caso escapou do mapeamento para `auth_required` em vez de chegar como conexão inexistente.
