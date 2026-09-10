---
category: integration
audience: suporte
summary: Uma fala do bot chegou ao cliente mas não foi registrada no chat do canal aberto.
---
# thinkzap.bot.echo_failed

## O que significa
Cada mensagem que o bot de atendimento envia faz dois caminhos: um leva a mensagem ao cliente no WhatsApp, o outro registra a mesma mensagem no chat do canal aberto, para o atendente ver o que já foi dito quando assumir a conversa.

Este aviso diz que o primeiro caminho funcionou e o segundo falhou.

**O cliente recebeu a mensagem.** O atendimento não foi afetado. O que ficou faltando é o registro daquela fala no histórico que o atendente lê dentro do Bitrix24.

## Causa provável
- **Instabilidade momentânea** do Bitrix24 no instante do registro. É a causa mais comum, e some sozinha.
- **A conversa foi encerrada** no Bitrix24 entre o envio ao cliente e o registro.
- **O bot deixou de participar da conversa** — nesse caso costuma aparecer junto o aviso `thinkzap.bot.say_session_gone`.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo identificador do evento (o traceKey da tela de Logs).
2. Confirme o código de erro `thinkzap.bot.echo_failed` e anote o `chatId`.
3. Abra a conversa no Bitrix24: as falas anteriores do bot devem estar lá, e faltará a do horário do aviso.
4. Confirme com o cliente (ou pela conversa do WhatsApp) que a mensagem chegou. Se **não** chegou, o problema é outro — procure no mesmo horário um aviso de falha de envio.

## Como resolver
1. Nenhuma ação corretiva: a mensagem não deve ser reenviada, porque o cliente já a recebeu. Reenviar mandaria a mesma mensagem duas vezes.
2. Se o atendente precisar saber o que foi dito, o conteúdo está na conversa do WhatsApp com o cliente.
3. Se o aviso aparecer de forma repetida, e não isolada, acione o desenvolvimento — registro falhando sempre indica que o bot não está mais participando das conversas.

## Quando escalar
Escale se o aviso se repete em várias conversas, ou se vier acompanhado de relatos de que o cliente **não** recebeu as mensagens (nesse caso o problema é de envio, não de registro). Acione a equipe de desenvolvimento e anexe: identificador do evento (traceKey), código de erro `thinkzap.bot.echo_failed`, `chatId`, domínio/portal do parceiro e horário do evento.
