---
category: internal
audience: suporte
summary: Observabilidade — o gateway cobra uma quantidade de linhas diferente das linhas ativas no CRM; nada foi criado nem cancelado.
---
# thinkzap.gateway.quantity_divergence

## O que significa
A quantidade de linhas cobrada no gateway de pagamento não bate com as linhas ativas no CRM (SPA 1146). O sistema **não cria nem cancela nada** por causa disso, porque o CRM é a fonte de verdade do que existe. O registro serve para alguém reconciliar à mão.

Aparece em dois momentos: num evento `subscription.updated` do gateway (com `gatewayQuantity` e `spaLineCount`) e na leitura do estado da assinatura (com `billedCount` e `lineCount`).

## Causa provável
- **Cliente alterou a quantidade** no portal de faturamento do gateway.
- **Linha criada ou apagada à mão** no CRM sem ajustar a cobrança.

## Como verificar
1. Filtre os Logs e confirme `código de erro: thinkzap.gateway.quantity_divergence`.
2. Compare a quantidade no item da assinatura no gateway com as linhas ativas da instalação na SPA 1146.

## Como resolver
1. Gateway a mais: ajustar a quantidade no gateway (o cliente está pagando por linha que não tem).
2. Gateway a menos: confirmar com o comercial se a linha extra é cortesia; se não for, ajustar a cobrança.

## Quando escalar
Se a divergência volta depois de ajustada. Anexe: `gatewaySubscriptionId`, as duas contagens e o domínio.
