---
category: internal
audience: suporte
summary: Seu pagamento foi aprovado, mas a linha ainda não foi liberada.
---
# thinkzap.subscription.line_blocked_after_payment

## O que significa
**Caso URGENTE e crítico de atrito com o cliente.** O pagamento foi aprovado, mas a linha de WhatsApp **continua bloqueada** — o cliente pagou e não recebeu o que contratou. É a situação que mais gera insatisfação, então trate com prioridade.

**Deixe claro para o cliente, de imediato:**
- O pagamento foi recebido e reconhecido; **não haverá nenhuma nova cobrança**.
- A liberação da linha será feita **manualmente** pelo suporte/desenvolvimento, o mais rápido possível.

## Causa provável
- **Falha interna após a confirmação do pagamento**: a cobrança foi confirmada no gateway (Stripe), mas o passo que destrava a linha não foi concluído.
- **Estado inconsistente da linha**: a linha ficou marcada como bloqueada mesmo com o pagamento aprovado.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.subscription.line_blocked_after_payment`.
3. Leia na linha do log o e-mail/portal e a linha envolvida, e confirme no gateway de pagamento (Stripe) que a cobrança foi aprovada — isso confirma que é apenas a liberação que está pendente.

## Como resolver
1. Priorize o atendimento: trate como URGENTE.
2. Tranquilize o cliente: pagamento recebido, **sem nova cobrança**, liberação manual em andamento.
3. Acione imediatamente o suporte/desenvolvimento com o e-mail da conta e o portal para **destravar a linha manualmente**.
4. Após a liberação, confirme com o cliente que a linha voltou a funcionar.

## Quando escalar
Escale **imediatamente** para a equipe de desenvolvimento — a liberação é manual e o caso é urgente. Anexe: `traceKey`, `código de erro: thinkzap.subscription.line_blocked_after_payment`, domínio/portal do parceiro, horário do evento, e-mail da conta e o id da linha bloqueada. Reforce que o cliente **já pagou** e que **não se deve cobrar de novo**.
