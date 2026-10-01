---
category: internal
audience: suporte
summary: Observabilidade — a mensagem do operador foi entregue, mas não foi registrada no nosso banco; status de entrega e citações dela não vão casar.
---
# thinkzap.message.outbound_persist_failed

## O que significa
A mensagem que o operador enviou, pelo canal aberto ou pelo widget do CRM, **chegou ao contato**. O que falhou foi a gravação local da mensagem, que liga o id do provider ao id da mensagem no Bitrix24. No widget, o log traz `outboxId` em vez de `bitrixMessageId`.

Sem esse registro:
- os status de entrega (entregue, lida) dessa mensagem não são refletidos no chat;
- se o contato responder citando essa mensagem, a citação não é resolvida e a resposta chega sem o trecho citado.

A conversa segue normal. Nada precisa ser reenviado.

## Causa provável
- **Indisponibilidade momentânea do banco** (conexão, timeout).
- **Registro duplicado**: o mesmo envio foi gravado antes, por exemplo numa retentativa do job.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` ou pelo `instanceId`.
2. Confirme `código de erro: thinkzap.message.outbound_persist_failed` e `dbWriteFailed: true`.
3. O log traz `providerMessageId`, `bitrixMessageId` e o `err` do banco.

## Como resolver
Nenhuma ação de suporte para a conversa. Se o parceiro reclamar de status ou citação faltando numa mensagem específica, confirme por este log que essa mensagem caiu aqui.

## Quando escalar
Se o código aparece em volume (muitas mensagens, vários portais), acione a equipe de desenvolvimento: provavelmente o banco está indisponível. Anexe: `código de erro: thinkzap.message.outbound_persist_failed`, a janela de horário e alguns `traceKey`.
