---
category: internal
audience: observabilidade
stub: true
summary: Aviso de documento já assinado que havia sido processado antes — ignorado para não duplicar.
---
# clicksign.event.already_processed

## Direção (dev)
- **Causa provável:** Um evento de documento fechado já processado foi recebido de novo e ignorado.
- **Investigar:** Comportamento esperado (idempotência); não é erro, é evento duplicado.
