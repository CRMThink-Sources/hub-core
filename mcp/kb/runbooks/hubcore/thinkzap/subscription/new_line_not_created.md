---
category: internal
audience: suporte
summary: Observabilidade — pagamento aprovado e a nova linha não foi criada; reconciliar à mão.
---
# thinkzap.subscription.new_line_not_created

## O que significa
Caso de reconciliação: o pagamento foi aprovado, mas a nova linha correspondente não chegou a ser criada. O cliente **já pagou**, e a linha precisa ser criada manualmente conferindo os dados no log.

**Importante para tranquilizar o cliente:** o pagamento está reconhecido e **não haverá nova cobrança** — a linha será criada **manualmente** pelo suporte/desenvolvimento.

## Causa provável
- **Falha interna após a confirmação do pagamento**: a cobrança foi confirmada, mas a criação da linha não foi disparada ou não terminou.
- **Estado inconsistente**: a assinatura foi paga, porém sem a linha vinculada.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.subscription.new_line_not_created`.
3. Localize no log o e-mail/portal e a assinatura, e confirme no gateway de pagamento (Stripe) que a cobrança foi aprovada.

## Como resolver
1. Tranquilize o cliente: pagamento reconhecido, **sem nova cobrança**, linha a ser criada manualmente.
2. Acione o suporte/desenvolvimento com o e-mail da conta e o portal para localizar a assinatura e **criar a linha manualmente**, reconciliando com o pagamento aprovado.
3. Após a criação, confirme com o cliente que a nova linha está disponível para conectar.

## Quando escalar
Este caso exige reconciliação manual — acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.subscription.new_line_not_created`, domínio/portal do parceiro, horário do evento, e-mail da conta e o id da assinatura. Reforce que o cliente **já pagou** e que **não se deve cobrar de novo**.
