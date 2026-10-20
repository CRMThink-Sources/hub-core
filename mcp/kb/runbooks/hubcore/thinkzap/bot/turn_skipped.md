---
audience: suporte
title: Bot ligado em canal sem fluxo para rodar
errorCode: thinkzap.bot.turn_skipped
---

# O que aconteceu

O bot de atendimento está ligado num canal aberto do Bitrix24, recebeu a mensagem do
cliente, e não havia fluxo para executar.

A conversa foi **entregue à fila da linha** — o cliente cai no atendimento humano em vez de
ficar num chat onde ninguém responde.

# Como identificar

O campo `reason` no log diz qual é o caso:

| `reason` | significado |
|---|---|
| `sem-vinculo` | o canal não tem nenhum fluxo vinculado na nossa tabela |
| `vinculo-inativo` | existe vínculo, marcado como desativado |
| `fluxo-ausente` | o vínculo aponta para um fluxo que foi apagada |
| `fluxo-nao-publicado` | o fluxo voltou a rascunho com o vínculo ainda ativo |
| `sem-conector-ativo` | a instalação não tem nenhuma linha ThinkZap contratada e ativa (teste vencido, assinatura cancelada ou `past_due`, ou todas as linhas removidas) |

O log traz também `lineId` (o `CONFIG_ID` do canal aberto no Bitrix) e `chatId`.

# O que fazer

Em todos os casos o estado é o mesmo: **o Bitrix tem o bot no canal e nós não temos fluxo
para ele.** Duas saídas, e a escolha é do parceiro:

**Quer o bot atendendo** — abrir o ThinkBot, publicar o fluxo e vinculá-la ao canal
indicado por `lineId`.

**Não quer mais o bot** — remover o vínculo pelo ThinkBot. Isso desliga o bot do canal no
portal, e o canal volta ao atendimento humano direto, sem a passagem pela fila.

Se `reason` for `sem-conector-ativo`, o fluxo e o vínculo estão certos: o ThinkBot só atende
com uma linha ThinkZap ativa na instalação. Contratar ou reativar a linha basta — o bot volta
a atender na próxima conversa, sem mexer no vínculo. Ver o runbook de
`thinkzap.bot.connector_inactive`.

Se `reason` for `sem-vinculo` e o parceiro disser que nunca vinculou nada àquele canal: o
bot foi ligado ali fora do ThinkBot, ou a remoção de um vínculo antigo falhou pela metade.
Ver o runbook de `thinkzap.bot.line_unbind_failed`.

# Quando escalar

Se o parceiro remover o vínculo pelo ThinkBot e o erro continuar aparecendo para o mesmo
`lineId`: o `WELCOME_BOT_ID` ficou no canal apesar do desvínculo, e precisa de análise.
