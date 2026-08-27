---
category: integration
audience: suporte
stub: true
summary: O GPT Maker recusou a criação do agente.
---
# gptmaker.agent.create_failed

## Direção (suporte)
- **Causa provável:** Indisponibilidade ou recusa da API do GPT Maker (`POST /v2/workspace/{id}/agents`).
- **Investigar:** Ler a linha com o `traceKey` e o retorno do vendor. Nenhum agente foi criado e nada foi gravado — pode tentar de novo sem risco de duplicar.
