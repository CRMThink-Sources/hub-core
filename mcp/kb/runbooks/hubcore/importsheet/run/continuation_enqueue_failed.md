---
category: internal
audience: observabilidade
stub: true
summary: Falha ao reenfileirar a próxima página da importação; a rodada pode travar no meio.
---
# importsheet.run.continuation_enqueue_failed

## Direção (dev)
- **Causa provável:** A página atual foi processada, mas falhou o reenfileiramento da próxima página; sem a continuação, a importação pode parar no meio.
- **Investigar:** Saúde da fila (BullMQ) e do Redis; reenfileirar manualmente a continuação a partir do cursor se necessário.
