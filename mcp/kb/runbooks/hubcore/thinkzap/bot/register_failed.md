---
category: integration
audience: suporte
summary: Não foi possível registrar o bot de atendimento no Bitrix24; o fluxo não pôde ser vinculada ao canal.
---
# thinkzap.bot.register_failed

## O que significa
Para um fluxo atender num canal aberto, o app precisa registrar um bot de mensageria dentro do Bitrix24. Este erro indica que o registro não foi concluído, então o vínculo entre o fluxo e o canal **não** foi criado — nada mudou no portal, e o canal continua no atendimento humano.

Cada fluxo tem o seu próprio bot, registrado no primeiro vínculo daquele fluxo. Se o fluxo já está vinculado a outro canal com sucesso, o bot dele existe e este erro não deve aparecer.

## Causa provável
- **Permissões do app**: falta o escopo `imbot` (bot de mensageria) liberado para o app no portal. É a causa mais comum.
- **Limite de bots**: o Bitrix24 permite até 100 bots por aplicativo no portal.
- **Instabilidade momentânea**: o Bitrix24 não respondeu o pedido de registro.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.bot.register_failed`.
3. Leia na linha do log a mensagem devolvida pelo Bitrix24 — `BOT_LIMIT_EXCEEDED` indica limite de bots; mensagem de acesso/escopo indica permissão.
4. Confirme com o parceiro se o app foi instalado depois da última atualização de escopos.

## Como resolver
1. Se for permissão: oriente a reinstalar/reautorizar o app no portal, confirmando que o escopo de bot de mensageria (`imbot`) está liberado.
2. Se for limite de bots: o parceiro precisa remover bots não usados no portal antes de tentar de novo.
3. Como o erro é retentável, peça para repetir o vínculo em instantes e confirme na tela de Logs que não voltou a aparecer.
4. Enquanto isso, o canal aberto atende normalmente por operador humano — nenhuma conversa é perdida.

## Quando escalar
Se o escopo `imbot` está liberado, o portal está dentro do limite de bots e o registro continua falhando, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.bot.register_failed`, domínio/portal do parceiro, horário do evento, e-mail da conta e a mensagem devolvida pelo Bitrix24.
