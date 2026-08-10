---
category: internal
audience: dev
stub: true
summary: O processamento em segundo plano falhou mesmo após esgotar todas as tentativas.
---
# clicksign.worker.job_failed

## Direção (dev)
- **Causa provável:** O job da fila falhou depois de esgotar as tentativas.
- **Investigar:** Ver o erro subjacente do job na linha de log e investigar a causa raiz.
