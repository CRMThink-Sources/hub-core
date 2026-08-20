---
category: integration
audience: suporte
summary: Não foi possível iniciar o pagamento da assinatura.
---
# thinkzap.gateway.checkout_create_failed

## O que significa
Ao contratar por cartão, o app thinkzap pede ao gateway de pagamento (hoje o Stripe) que abra a tela de pagamento (checkout) da assinatura. Este erro indica que essa abertura falhou — o cliente não chegou a ver a tela de pagamento. A cobrança não foi feita, então não há risco de cobrança duplicada.

## Causa provável
- **Instabilidade momentânea** do gateway de pagamento.
- **Lentidão de rede**: o gateway demorou demais para responder.
- **Dado da assinatura recusado** pelo gateway ao montar o checkout.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.gateway.checkout_create_failed`.
3. Leia, na linha do log, a resposta que o gateway devolveu ao tentar abrir o checkout.

## Como resolver
1. Oriente o cliente a tentar a contratação por cartão de novo em instantes — como nenhuma cobrança foi feita, não há risco de pagar duas vezes.
2. Se a tela de pagamento abrir na nova tentativa, o caso está resolvido.
3. Se persistir, colete o horário e o `traceKey` e acione o suporte.

## Quando escalar
Se o cliente tentar de novo e o checkout continuar não abrindo, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.gateway.checkout_create_failed`, domínio do parceiro, horário do evento, o e-mail da conta e os ids envolvidos.
