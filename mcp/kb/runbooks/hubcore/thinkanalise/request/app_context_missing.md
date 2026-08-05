---
category: validation
audience: dev
stub: true
summary: Requisição autenticada sem contexto de app/domínio.
---
# thinkanalise.request.app_context_missing

## Direção (dev)
- **Causa provável:** A requisição chegou autenticada mas sem o contexto de app/domínio necessário pra resolver o portal.
- **Investigar:** Ler a linha de log com o `traceKey` e verificar de onde deveria vir o app/domínio (middleware de auth ou parâmetros da chamada).
