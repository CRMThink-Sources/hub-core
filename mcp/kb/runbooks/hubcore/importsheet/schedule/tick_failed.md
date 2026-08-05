---
category: internal
audience: observabilidade
stub: true
summary: O ciclo do agendador (poller) falhou.
---
# importsheet.schedule.tick_failed

## Direção (dev)
- **Causa provável:** Uma passada do agendador (poller que dispara as importações agendadas) falhou.
- **Investigar:** Saúde do worker/scheduler; se recorrente, as importações agendadas param de disparar.
