---
category: integration
audience: suporte
stub: true
summary: O GPT Maker recusou a alteração do agente.
---
# gptmaker.agent.update_failed

## Direção (suporte)
- **Causa provável:** Indisponibilidade ou recusa da API do GPT Maker (`PUT /v2/agent/{id}`).
- **Investigar:** Ler a linha com o `traceKey`. A alteração não foi aplicada; o agente segue com a configuração anterior.
