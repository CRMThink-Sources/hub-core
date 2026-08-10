---
category: internal
audience: suporte
summary: Não foi possível concluir a criação da linha adicional.
---
# thinkzap.subscription.additional_line_failed

## O que significa
O cliente pediu uma linha adicional na assinatura, mas a criação dessa nova linha não pôde ser concluída. Se o pedido envolveu cobrança e ela foi aprovada, o valor já foi pago e só a criação da linha ficou pendente.

**Importante para tranquilizar o cliente:** se houve cobrança, **não haverá novo pagamento** — a linha adicional será criada **manualmente** pelo suporte/desenvolvimento.

## Causa provável
- **Falha interna após o pagamento**: a cobrança da linha adicional foi confirmada, mas a criação não terminou.
- **Instabilidade na criação da linha**: houve um erro ao provisionar a nova linha.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.subscription.additional_line_failed`.
3. Leia na linha do log o e-mail/portal da conta e verifique no gateway de pagamento (Stripe) se houve cobrança aprovada para a linha adicional.

## Como resolver
1. Se houve cobrança aprovada, tranquilize o cliente: **não haverá novo pagamento** e a linha será criada manualmente.
2. Acione o suporte/desenvolvimento com o e-mail da conta e o portal para concluir a criação da linha adicional manualmente.
3. Após a criação, confirme com o cliente que a nova linha está disponível para conectar (aba Conexão / QR Code).

## Quando escalar
Se houve cobrança, o caso exige ação manual — acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.subscription.additional_line_failed`, domínio/portal do parceiro, horário do evento, e-mail da conta e os ids da assinatura/linha. Reforce que, havendo cobrança, **não se deve cobrar de novo**.
