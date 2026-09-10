---
category: integration
audience: suporte
summary: Uma fala do bot de atendimento não chegou ao cliente.
---
# thinkzap.bot.say_failed

## O que significa
O bot de atendimento tentou enviar uma mensagem na conversa do WhatsApp (uma saudação, uma pergunta do menu, um aviso) e o Bitrix24 recusou o envio. O cliente ficou sem essa mensagem. Se era uma pergunta, ele não tem o que responder e a conversa para ali até alguém assumir.

## Causa provável
- **Bot não está na linha**: o canal aberto foi reconfigurado e o bot de atendimento deixou de estar ativo nele.
- **Sessão já encerrada**: a conversa foi fechada (pelo operador ou por inatividade) entre o momento em que o bot decidiu falar e o momento do envio.
- **Instabilidade momentânea**: o Bitrix24 não respondeu na hora.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.bot.say_failed` e anote o `chatId` da linha.
3. Abra a conversa no Bitrix24 e veja se ela ainda está aberta e se o bot aparece como participante.
4. Leia na linha do log a mensagem devolvida pelo Bitrix24 — ela costuma dizer se foi sessão encerrada ou permissão.

## Como resolver
1. Se o bot não está na linha: abra a configuração do canal aberto no Bitrix24 e confirme que o bot de atendimento do thinkzap está ativo nela.
2. Se a conversa já estava encerrada, não há ação: a próxima mensagem do cliente abre uma sessão nova e o fluxo recomeça.
3. Como o erro é retentável, confirme na tela de Logs que ele não voltou a aparecer nas conversas seguintes.
4. Enquanto isso, a conversa afetada pode ser atendida normalmente por um operador humano.

## Quando escalar
Se o bot está ativo na linha, as conversas estão abertas e as falas continuam falhando, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.bot.say_failed`, `chatId`, domínio/portal do parceiro, horário do evento e a mensagem devolvida pelo Bitrix24.
