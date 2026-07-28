---
category: integration
audience: observabilidade
stub: true
summary: O Bitrix24 retornou limite de intensidade de requisições e o worker pausou antes de retomar.
---
# importsheet.bitrix.intensity_limit

## Direção (dev)
- **Causa provável:** Bitrix24 devolveu limite de intensidade (503, QUERY_LIMIT_EXCEEDED/OVERLOAD por IP); o worker pausa ~10s e retoma sozinho.
- **Investigar:** Normalmente autorregulado; se for constante, reduzir a concorrência das chamadas.
