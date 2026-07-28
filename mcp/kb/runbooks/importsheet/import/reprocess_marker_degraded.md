---
category: internal
audience: observabilidade
stub: true
summary: Falha ao gravar o marcador de reprocess no Redis; idempotência degradada.
---
# importsheet.import.reprocess_marker_degraded

## Direção (dev)
- **Causa provável:** Não foi possível gravar o marcador de reprocess no Redis; a proteção de idempotência do reprocessamento fica degradada.
- **Investigar:** Saúde e disponibilidade do Redis.
