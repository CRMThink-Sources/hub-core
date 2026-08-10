---
category: integration
audience: suporte
summary: Um pagamento foi confirmado no gateway mas o processamento interno falhou.
---
# thinkzap.gateway.webhook_handler_failed

## O que significa
O gateway de pagamento (hoje o Stripe) confirmou um pagamento e avisou o app thinkzap, mas o processamento desse aviso falhou. Ou seja, a cobrança do cliente ocorreu, porém a consequência dela (liberar a linha/assinatura) não foi concluída. O evento é reprocessado automaticamente, então na maioria dos casos a liberação acontece sozinha logo em seguida.

## Causa provável
- **Instabilidade momentânea** no processamento do evento.
- **Estado inesperado** ao aplicar a confirmação do pagamento.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.gateway.webhook_handler_failed`.
3. Verifique se, em uma retentativa posterior, o evento foi processado com sucesso e a linha/assinatura foi liberada.

## Como resolver
1. Como o evento é reprocessado automaticamente, aguarde e verifique se a linha do cliente foi liberada em seguida.
2. Tranquilize o cliente: o pagamento foi confirmado no gateway e não haverá nova cobrança.
3. Se após as retentativas a linha não liberar, acione o suporte com o e-mail da conta.

## Quando escalar
Se as retentativas não concluírem e a linha continuar bloqueada mesmo com o pagamento confirmado, acione a equipe de desenvolvimento — é liberação manual, sem nova cobrança. Anexe: `traceKey`, `código de erro: thinkzap.gateway.webhook_handler_failed`, domínio do parceiro, horário do evento, o e-mail da conta e os ids envolvidos.
