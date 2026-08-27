---
category: integration
audience: suporte
stub: true
summary: O Bitrix recusou a criação do imbot.
---
# gptmaker.bot.create_failed

## Direção (suporte)
- **Causa provável:** Falta de escopo `imbot` no app instalado, ou indisponibilidade do portal.
- **Investigar:** Ler o retorno de `imbot.register` na linha com o `traceKey`. Se for escopo, reinstalar o app com os escopos corretos.
