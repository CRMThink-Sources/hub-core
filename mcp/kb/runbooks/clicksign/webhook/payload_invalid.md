---
category: validation
audience: dev
stub: true
summary: Corpo do webhook não é JSON válido ou sem nome de evento.
---
# clicksign.webhook.payload_invalid

## Direção (dev)
- **Causa provável:** O corpo do webhook não é JSON válido ou veio sem o nome do evento.
- **Investigar:** Inspecionar o payload bruto recebido; verificar se a Clicksign mudou o formato ou se é chamada de teste malformada.
