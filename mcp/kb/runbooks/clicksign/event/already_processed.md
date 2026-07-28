---
category: internal
audience: observabilidade
stub: true
summary: Evento de documento fechado já processado — ignorado (idempotência).
---
# clicksign.event.already_processed

## Direção (dev)
- **Causa provável:** Um evento de documento fechado já processado foi recebido de novo e ignorado.
- **Investigar:** Comportamento esperado (idempotência); não é erro, é evento duplicado.
