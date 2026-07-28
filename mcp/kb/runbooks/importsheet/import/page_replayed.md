---
category: internal
audience: observabilidade
stub: true
summary: Página já escrita numa tentativa anterior; o cursor apenas avançou, sem reescrever.
---
# importsheet.import.page_replayed

## Direção (dev)
- **Causa provável:** A página já havia sido gravada numa tentativa anterior; a proteção de idempotência evitou a reescrita e o cursor apenas avançou.
- **Investigar:** Benigno; só relevante se vier acompanhado de outras falhas (ex.: quedas de worker ou marcadores degradados).
