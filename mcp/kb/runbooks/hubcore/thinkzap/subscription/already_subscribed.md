---
category: validation
audience: suporte
summary: Esta conta já tem uma assinatura ativa.
---
# thinkzap.subscription.already_subscribed

## O que significa
O parceiro tentou contratar, mas a conta já possui uma assinatura ativa. Por isso a nova contratação não segue por aqui. Não é cobrança indevida nem falha técnica: é uma regra que evita assinaturas duplicadas. Trocar de plano por esse fluxo não está disponível; isso é gerenciado pela área de faturamento.

## Causa provável
- **Assinatura já ativa**: a conta contratou anteriormente e a assinatura segue vigente.
- **Tentativa de trocar de plano pelo fluxo de contratação**: a troca não é feita por aqui.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.subscription.already_subscribed`.
3. Confira que a conta consta com uma assinatura ativa.

## Como resolver
1. Explique ao parceiro que já existe uma assinatura ativa e por isso a nova contratação não é permitida.
2. Para ajustes de plano, oriente a usar a área de faturamento da conta.
3. Se o objetivo não estiver claro, acione o suporte para orientar a próxima ação.

## Quando escalar
Se o parceiro afirmar que não possui assinatura ativa e ainda assim receber este erro, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.subscription.already_subscribed`, domínio do parceiro, o e-mail da conta e o horário do evento.
