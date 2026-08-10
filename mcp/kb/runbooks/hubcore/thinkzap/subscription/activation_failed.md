---
category: internal
audience: suporte
summary: Seu pagamento foi aprovado, mas a ativação da assinatura não pôde ser concluída automaticamente.
---
# thinkzap.subscription.activation_failed

## O que significa
O pagamento do cliente foi aprovado normalmente, mas o passo seguinte — ativar a assinatura e liberar o serviço — não pôde ser concluído automaticamente. Ou seja, o cliente **já pagou**, e a única coisa pendente é a ativação, que ficou travada por uma falha interna após a confirmação da cobrança.

**Importante para tranquilizar o cliente:** não há nada errado com o pagamento e **não haverá nova cobrança**. A liberação é feita **manualmente** pelo suporte/desenvolvimento.

## Causa provável
- **Falha interna após o pagamento**: a cobrança foi confirmada, mas o processo de ativação não terminou por um erro no processamento.
- **Estado inconsistente**: algum dado necessário para concluir a ativação ficou incompleto no momento do processamento.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.subscription.activation_failed`.
3. Leia na linha do log o e-mail/portal da conta e confirme, no gateway de pagamento (Stripe), que a cobrança realmente foi aprovada — isso confirma que o caso é apenas de ativação pendente.

## Como resolver
1. Tranquilize o cliente: o pagamento foi aprovado, **não haverá nova cobrança**, e a liberação será feita manualmente.
2. Acione o suporte/desenvolvimento com o e-mail da conta e o portal para que a ativação da assinatura seja concluída manualmente.
3. Após a liberação manual, confirme com o cliente que o serviço/linha está disponível.

## Quando escalar
Este caso praticamente sempre exige ação manual do time. Acione a equipe de desenvolvimento assim que confirmar o pagamento aprovado. Anexe: `traceKey`, `código de erro: thinkzap.subscription.activation_failed`, domínio/portal do parceiro, horário do evento, e-mail da conta e os ids da assinatura/linha envolvidos. Reforce que **não se deve cobrar de novo**.
