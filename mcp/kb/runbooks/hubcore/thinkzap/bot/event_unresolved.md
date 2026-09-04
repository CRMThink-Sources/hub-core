---
audience: suporte
title: Evento do bot sem instalação ou canal resolvido
errorCode: thinkzap.bot.event_unresolved
---

# O que aconteceu

O Bitrix24 avisou que chegou mensagem para o bot de atendimento, e o ThinkZap não
conseguiu descobrir **a qual instalação ou a qual canal aberto** aquela conversa pertence.
O turno do fluxo não rodou.

A conversa não fica parada: o bot não responde, e o canal segue com o atendimento humano
pelo tempo de espera da linha.

# Como identificar

No log, o campo que vem preenchido diz onde a resolução parou:

| campo no log | o que faltou |
|---|---|
| `domain` presente, sem mais nada | o domínio do evento não corresponde a nenhuma instalação nossa |
| `domainId` presente | o domínio existe, mas não há instalação do ThinkZap nele |
| `appId` presente, mensagem sobre credencial | a instalação existe e está sem credencial gravada |
| `appId` presente, mensagem sobre registro | o bot existe no portal do cliente e não na nossa tabela |
| `chatId` presente, mensagem sobre linha | `imopenlines.dialog.get` não devolveu um chat de canal aberto |

# O que fazer

**Domínio ou instalação não encontrados** — normal se o cliente desinstalou o app e o bot
ficou registrado no portal. O bot antigo continua recebendo evento e não tem para onde
rodar. Pedir ao parceiro para remover o bot **ThinkZap Atendimento** pela lista de bots do
portal, ou reinstalar o app.

**Sem credencial** — a instalação perdeu o token. Reinstalar o app no portal recria a
credencial.

**Bot no portal e não no banco** — aconteceu se a remoção do vínculo apagou nossa row e o
`unregister` no Bitrix falhou. Ver o runbook de `thinkzap.bot.unregister_failed`. O
sintoma para o cliente é bot que entra na conversa e não fala.

**Chat sem linha** — o bot foi adicionado a um chat que não é de canal aberto (chat de
grupo, chat de CRM). Não há fluxo aplicável; nenhuma ação necessária se for pontual.

# Quando escalar

Se aparecer repetidamente com `appId` preenchido e a instalação estiver ativa: é
divergência entre o portal e nossa tabela de bots, e precisa de análise.
