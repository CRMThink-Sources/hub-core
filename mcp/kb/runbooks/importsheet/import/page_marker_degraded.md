---
category: internal
audience: observabilidade
stub: true
summary: Falha ao registrar o controle de progresso da importação; há risco de reprocessar a mesma parte da planilha.
---
# importsheet.import.page_marker_degraded

## Direção (dev)
- **Causa provável:** Não foi possível gravar o marcador de página no Redis; sem ele, a proteção de idempotência fica degradada e a mesma página pode ser reescrita.
- **Investigar:** Saúde e disponibilidade do Redis.
