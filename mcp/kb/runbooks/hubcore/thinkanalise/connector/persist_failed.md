---
category: internal
audience: dev
stub: true
summary: Falha ao persistir os dados do conector no banco.
---
# thinkanalise.connector.persist_failed

## Direção (dev)
- **Causa provável:** A gravação dos dados do conector no banco local do CRMThink falhou.
- **Investigar:** Ler a linha de log com o `traceKey` e checar o erro da camada de persistência (conexão, constraint ou schema) — atenção a inconsistência caso o conector já tenha sido criado no Bitrix.
