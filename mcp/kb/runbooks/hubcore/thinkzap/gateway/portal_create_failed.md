---
category: integration
audience: suporte
summary: Não foi possível abrir o portal de faturamento agora.
---
# thinkzap.gateway.portal_create_failed

## O que significa
O portal de faturamento é a área, hospedada pelo gateway de pagamento (hoje o Stripe), onde o cliente gerencia a assinatura e os dados de cobrança. Este erro indica que o app thinkzap não conseguiu abrir esse portal no momento. Nada foi alterado na assinatura; o cliente apenas não conseguiu acessar a área agora.

## Causa provável
- **Instabilidade momentânea** do gateway de pagamento.
- **Lentidão de rede**: o gateway demorou demais para responder.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.gateway.portal_create_failed`.
3. Leia, na linha do log, a resposta que o gateway devolveu ao tentar abrir o portal.

## Como resolver
1. Oriente o cliente a tentar abrir o portal de faturamento de novo em instantes — o erro costuma ser passageiro.
2. Se abrir na nova tentativa, o caso está resolvido.
3. Se persistir, colete o horário e o `traceKey` e acione o suporte.

## Quando escalar
Se o cliente tentar de novo e o portal continuar não abrindo, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.gateway.portal_create_failed`, domínio do parceiro, horário do evento, o e-mail da conta e os ids envolvidos.
