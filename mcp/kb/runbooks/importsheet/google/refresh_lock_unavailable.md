---
category: integration
audience: observabilidade
stub: true
summary: Não foi possível renovar o acesso ao Google após várias tentativas (outra renovação estava em andamento).
---
# importsheet.google.refresh_lock_unavailable

## Direção (dev)
- **Causa provável:** Não conseguiu adquirir o lock de renovação do token Google após ~10 tentativas.
- **Investigar:** Contenção de lock/Redis; concorrência de runs do mesmo app disputando a renovação.
