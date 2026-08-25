---
category: integration
audience: suporte
stub: true
summary: O Bitrix recusou a remoção do imbot.
---
# gptmaker.bot.delete_failed

## Direção (suporte)
- **Causa provável:** Indisponibilidade do portal, ou bot já removido por fora.
- **Investigar:** Bot já inexistente **não** cai aqui — esse caso conclui com sucesso, porque o estado desejado já é o corrente. Se caiu aqui, o portal recusou de fato.
