---
category: integration
audience: observabilidade
stub: true
summary: O teste de módulos disponíveis do Omie falhou; o sistema seguiu com a lista completa por segurança.
---
# thinkanalise.omie.capability_probe_failed

## Direção (dev)
- **Causa provável:** A sondagem de módulos/capacidades do Omie falhou; o CRMThink seguiu com a lista completa como fallback.
- **Investigar:** Evento de observabilidade (não fatal). Ler a linha de log com o `traceKey`; investigar só se recorrente ou acompanhado de falhas na busca de dados do Omie.
