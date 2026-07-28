---
category: integration
audience: observabilidade
stub: true
summary: Não foi possível obter o lock para renovar o token Google após cerca de 10 tentativas.
---
# importsheet.google.refresh_lock_unavailable

## Direção (dev)
- **Causa provável:** Não conseguiu adquirir o lock de renovação do token Google após ~10 tentativas.
- **Investigar:** Contenção de lock/Redis; concorrência de runs do mesmo app disputando a renovação.
