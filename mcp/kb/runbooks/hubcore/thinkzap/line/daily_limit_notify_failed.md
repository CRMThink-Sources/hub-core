---
category: integration
audience: suporte
summary: A mensagem foi recusada pelo limite diário, mas o aviso ao operador no chat não pôde ser enviado.
---
# thinkzap.line.daily_limit_notify_failed

## O que significa
O operador respondeu um contato por uma linha Web (não oficial) que já tinha atingido o limite diário de mensagens. A mensagem foi recusada corretamente e não chegou ao contato. O aviso que explica isso no chat do canal aberto, porém, não pôde ser enviado, então o operador pode não ter percebido que a mensagem não saiu.

## Causa provável
- **O Bitrix24 recusou o aviso**: o bot do app não conseguiu postar no chat (bot removido, permissão ou instabilidade momentânea do portal).

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.line.daily_limit_notify_failed`.
3. No mesmo identificador do evento, confirme também o registro de `thinkzap.line.daily_limit_reached`.

## Como resolver
1. Explique ao parceiro que a mensagem não foi entregue por causa do limite diário da linha.
2. Siga o guia de `thinkzap.line.daily_limit_reached` para liberar um limite temporário ou aguardar a virada do dia.
3. Peça para o operador repetir o envio depois.

## Quando escalar
Se o aviso falhar com frequência no mesmo portal, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.line.daily_limit_notify_failed`, domínio do parceiro, o horário do evento e o identificador da linha.
