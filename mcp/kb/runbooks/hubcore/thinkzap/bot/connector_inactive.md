---
category: config
audience: suporte
summary: O ThinkBot só funciona com um conector ThinkZap contratado e ativo, e esta instalação não tem nenhum.
---
# thinkzap.bot.connector_inactive

## O que significa
O ThinkBot faz parte do ThinkZap: para um fluxo atender num canal aberto, a instalação precisa ter **ao menos uma linha ThinkZap contratada e ativa**. O parceiro tentou vincular (ou religar) um fluxo a um canal e o app recusou porque não encontrou nenhuma.

**Nada mudou no portal.** O fluxo não foi vinculado e o canal aberto continua como estava.

A exigência é por instalação, não por canal: com uma linha ativa, o bot pode atender qualquer canal aberto do portal.

## Causa provável
- A instalação nunca contratou uma linha ThinkZap.
- O teste gratuito venceu (prazo passou ou foi encerrado no CRM).
- A assinatura foi cancelada ou está com pagamento pendente (`past_due`).
- A assinatura está ativa, mas todas as linhas dela foram removidas.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo identificador do evento (o traceKey da tela de Logs).
2. Confirme o código de erro `thinkzap.bot.connector_inactive`.
3. No CRM da CRMThink, abra as assinaturas da instalação e confira status, fim do período e se há linha não cancelada.

## Como resolver
1. Oriente o parceiro a contratar ou reativar uma linha ThinkZap.
2. Com a linha ativa, peça para vincular o fluxo de novo pelo ThinkBot.

Repetir o vínculo sem resolver a assinatura dá o mesmo resultado, por isso este erro não é retentável.

## Quando escalar
Escale se o CRM mostra assinatura ativa (ou teste dentro do prazo) com linha não cancelada e o erro continua. Anexe: traceKey, domínio/portal do parceiro, horário do evento e o id da assinatura no CRM.
