---
category: integration
audience: suporte
summary: A configuração do bot de atendimento no Bitrix24 não pôde ser concluída.
---
# thinkzap.bitrix.bot_id_failed

## O que significa
Para atender no chat, o app thinkzap precisa registrar/configurar um bot de atendimento dentro do Bitrix24. Este erro indica que esse registro não pôde ser concluído. Sem o bot configurado, o atendimento por WhatsApp dentro do Bitrix24 pode não funcionar como esperado. Costuma ser uma falha de permissão ou passageira.

## Causa provável
- **Permissões do app no Bitrix24**: falta o escopo `imbot` (bot de mensageria) liberado para o app no portal.
- **Instabilidade momentânea**: o Bitrix24 não respondeu o pedido de registro do bot na hora.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.bitrix.bot_id_failed`.
3. Leia na linha do log a mensagem devolvida pelo Bitrix24 — ela costuma indicar se foi falta de permissão (escopo) ou uma falha passageira.

## Como resolver
1. Confirme com o parceiro que o app tem as permissões necessárias no Bitrix24, em especial o escopo de bot de mensageria (`imbot`).
2. Se faltava permissão, oriente a reinstalar/reautorizar o app no portal com os escopos completos.
3. Como o erro é retentável, peça para repetir a operação em instantes e confirme na tela de Logs que o erro não aparece mais.

## Quando escalar
Se as permissões estiverem corretas e o registro do bot continuar falhando, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.bitrix.bot_id_failed`, domínio/portal do parceiro, horário do evento, e-mail da conta e a mensagem devolvida pelo Bitrix24.
