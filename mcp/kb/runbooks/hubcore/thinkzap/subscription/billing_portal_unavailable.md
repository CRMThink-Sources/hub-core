---
category: validation
audience: suporte
summary: Não há faturamento a gerenciar para esta conta (sem assinatura por cartão).
---
# thinkzap.subscription.billing_portal_unavailable

## O que significa
O parceiro tentou abrir o portal de faturamento, mas a conta não tem uma assinatura por cartão para gerenciar ali. O portal de faturamento só faz sentido para contas com assinatura por cartão; a modalidade cobrada por boleto (manual) não usa esse portal. Por isso não há nada a abrir. Não é cobrança indevida nem falha técnica.

## Causa provável
- **Sem assinatura por cartão**: a conta não tem uma assinatura gerenciável pelo portal.
- **Modalidade por boleto (manual)**: essa modalidade não utiliza o portal de faturamento.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.subscription.billing_portal_unavailable`.
3. Confira qual é a modalidade de cobrança da conta (cartão vs boleto).

## Como resolver
1. Confirme se a conta tem, de fato, uma assinatura por cartão.
2. Se for modalidade por boleto, explique que o portal de faturamento não se aplica e conduza a solicitação pelo processo manual.
3. Se deveria haver assinatura por cartão e o portal não abre, siga para escalar.

## Quando escalar
Se a conta tiver assinatura por cartão e mesmo assim o portal não estiver disponível, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.subscription.billing_portal_unavailable`, domínio do parceiro, o e-mail da conta e o horário do evento.
