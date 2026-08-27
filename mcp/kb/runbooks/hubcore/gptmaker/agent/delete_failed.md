---
category: integration
audience: suporte
stub: true
summary: O GPT Maker recusou a exclusão do agente.
---
# gptmaker.agent.delete_failed

## Direção (suporte)
- **Causa provável:** Indisponibilidade ou recusa da API do GPT Maker.
- **Investigar:** A linha em `core_gpt_agents` foi **mantida** de propósito: apagá-la deixaria o agente vivo no workspace compartilhado e invisível para nós. Tentar de novo.
