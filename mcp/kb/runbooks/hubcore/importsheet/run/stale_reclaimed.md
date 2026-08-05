---
category: internal
audience: observabilidade
stub: true
summary: Importação presa em "running" por muito tempo foi retomada automaticamente pelo cursor.
---
# importsheet.run.stale_reclaimed

## Direção (dev)
- **Causa provável:** Uma importação ficou marcada como "running" por mais de ~20min (provável queda do worker no meio da rodada) e foi retomada automaticamente a partir do cursor.
- **Investigar:** Por que o worker caiu no meio da execução; se recorrente, checar saúde e estabilidade do worker.
