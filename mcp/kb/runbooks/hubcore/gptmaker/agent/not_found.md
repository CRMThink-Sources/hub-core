---
category: validation
audience: suporte
stub: true
summary: Agente não encontrado nesta instalação.
---
# gptmaker.agent.not_found

## Direção (suporte)
- **Causa provável:** O agente foi excluído, ou o id enviado pertence a **outra** instalação.
- **Investigar:** Os dois casos respondem igual de propósito: o workspace do GPT Maker é compartilhado, e distinguir "não existe" de "não é seu" confirmaria a existência do agente alheio. Conferir em `core_gpt_agents` se existe linha com esse `gpt_maker_agent_id` e a qual `app_id` ela pertence.
