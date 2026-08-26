---
category: validation
audience: suporte
stub: true
summary: Portal já tem 5 bots desta aplicação.
---
# gptmaker.bot.limit_reached

## Direção (suporte)
- **Causa provável:** O cliente tentou criar o 6º imbot.
- **Investigar:** Limite do Bitrix. A contagem é lida do portal (e não do nosso banco) justamente para refletir bots que o cliente apagou pelo painel. Se o cliente diz ter apagado um, reabrir a tela: a vaga aparece.
