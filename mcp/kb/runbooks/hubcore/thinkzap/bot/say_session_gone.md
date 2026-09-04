---
category: integration
audience: suporte
summary: O bot tentou falar numa conversa em que já não participa — normalmente porque um atendente assumiu.
---
# thinkzap.bot.say_session_gone

## O que significa
O bot de atendimento ia enviar uma mensagem, mas quando tentou o Bitrix24 respondeu que ele não faz mais parte daquela conversa. Isso acontece porque outra coisa aconteceu antes: um atendente humano assumiu o atendimento, ou a conversa foi encerrada.

**Na maior parte dos casos isto não é um problema.** É o registro de que o bot saiu de cena e o atendimento seguiu com uma pessoa. O cliente não ficou sem resposta — está falando com quem assumiu.

Ao ver este aviso, o app encerra a participação do bot naquela conversa em vez de tentar de novo, porque tentar de novo não passaria: o bot não tem mais permissão de escrever ali. Isso também libera a conversa para começar do início se o cliente voltar a escrever depois.

## Causa provável
- **Um atendente assumiu a conversa** enquanto o bot ainda estava no meio de uma pergunta. É a causa mais comum.
- **A conversa foi encerrada** no Bitrix24 (pelo atendente ou por falta de resposta do cliente) entre o momento em que o bot decidiu falar e o envio.
- **O bot foi retirado do canal aberto** no Bitrix24. Nesse caso o aviso se repete em várias conversas, e aí é configuração.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo identificador do evento (o traceKey da tela de Logs).
2. Confirme o código de erro `thinkzap.bot.say_session_gone` e anote o `chatId` da linha.
3. Abra essa conversa no Bitrix24 e veja quem está atendendo. Se há um atendente ou a conversa está fechada, o comportamento foi o esperado.
4. Veja se o aviso aparece em conversas isoladas ou em quase todas. Isoladas: normal. Quase todas: siga para a resolução.

## Como resolver
1. Se um atendente assumiu ou a conversa foi encerrada: nenhuma ação. A conversa está com quem a assumiu.
2. Se o aviso aparece em quase toda conversa, abra a configuração do canal aberto no Bitrix24 e confirme que o bot de atendimento do thinkzap continua ativo nele. Se não estiver, publique o fluxo novamente pelo app — isso reconfigura o vínculo.
3. Confirme depois, na tela de Logs, que as conversas novas voltaram a ser atendidas pelo bot.

## Quando escalar
Escale se o bot está ativo no canal aberto, as conversas estão abertas e sem atendente, e o aviso continua aparecendo — nessa combinação o bot está sendo removido da conversa por outro motivo. Acione a equipe de desenvolvimento e anexe: identificador do evento (traceKey), código de erro `thinkzap.bot.say_session_gone`, `chatId`, o código que o Bitrix24 devolveu (aparece no campo `code` da linha do log), domínio/portal do parceiro e horário do evento.
