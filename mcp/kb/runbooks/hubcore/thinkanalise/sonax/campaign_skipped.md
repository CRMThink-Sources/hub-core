---
category: integration
audience: observabilidade
stub: true
summary: O download de uma campanha do Sonax falhou e ela foi pulada.
---
# thinkanalise.sonax.campaign_skipped

## Direção (dev)
- **Causa provável:** O download de uma campanha específica do Sonax falhou; o CRMThink pulou essa campanha e seguiu com as demais.
- **Investigar:** Evento de observabilidade (não fatal). Ler a linha de log com o `traceKey` pra identificar a campanha pulada; investigar só se muitas campanhas forem puladas.
