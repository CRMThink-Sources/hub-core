---
category: integration
audience: observabilidade
stub: true
summary: Falha de rede ou demora excessiva ao consultar o Google Sheets (o serviço não respondeu a tempo).
---
# importsheet.google.unavailable

## Direção (dev)
- **Causa provável:** Falha de rede ou timeout ao consultar o Google Sheets, exposta como HTTP 504.
- **Investigar:** Provável caso transitório; se persistente, checar conectividade/saúde da API do Google e latência.
