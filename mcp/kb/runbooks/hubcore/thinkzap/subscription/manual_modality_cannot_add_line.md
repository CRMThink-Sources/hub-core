---
category: validation
audience: suporte
summary: A assinatura desta conta é cobrada por boleto.
---
# thinkzap.subscription.manual_modality_cannot_add_line

## O que significa
A conta está na modalidade de cobrança por boleto (modalidade manual). Nessa modalidade, adicionar uma nova linha não é feito pelo fluxo automático — precisa passar pelo suporte. Por isso a operação foi interrompida. Não é cobrança indevida nem falha técnica: é uma regra da modalidade de faturamento da conta.

## Causa provável
- **Modalidade de cobrança por boleto**: a conta é faturada manualmente, e a adição de linha nessa modalidade é feita pelo suporte.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.subscription.manual_modality_cannot_add_line`.
3. Confira que a assinatura da conta está na modalidade cobrada por boleto.

## Como resolver
1. Explique ao parceiro que, por a conta ser cobrada por boleto, a nova linha é adicionada pelo suporte.
2. Registre o pedido de linha adicional e conduza a inclusão pelo processo manual de faturamento.
3. Confirme com o parceiro após a inclusão.

## Quando escalar
Se a conta não for da modalidade por boleto e ainda assim receber este erro, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.subscription.manual_modality_cannot_add_line`, domínio do parceiro, o e-mail da conta e o horário do evento.
