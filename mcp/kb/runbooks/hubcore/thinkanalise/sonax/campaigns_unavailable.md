---
category: integration
audience: observabilidade
stub: true
summary: A lista de campanhas do Sonax ficou indisponível; retornou vazio.
---
# thinkanalise.sonax.campaigns_unavailable

## Direção (dev)
- **Causa provável:** A listagem de campanhas do Sonax não respondeu; o CRMThink retornou lista vazia.
- **Investigar:** Evento de observabilidade (não fatal). Ler a linha de log com o `traceKey`; investigar só se recorrente ou se o BI do Sonax vier sistematicamente vazio.
