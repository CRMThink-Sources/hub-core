---
category: config
audience: suporte
summary: O preço configurado de um plano não pôde ser calculado; o plano ficou fora da oferta ou aparece sem valor.
---
# thinkzap.subscription.plan_price_invalid

## O que significa
O preço do plano foi lido no gateway, mas o cálculo do valor recusou: a configuração do price (modo de cobrança, faixas) não é uma que o produto saiba calcular. O sistema não estima. O plano sai da oferta ou aparece sem valor, porque um número errado iria parar na fatura do cliente.

## Causa provável
- **Price com modo de cobrança não suportado**.
- **Faixas incompletas** no price.

## Como verificar
1. Filtre os Logs e confirme `código de erro: thinkzap.subscription.plan_price_invalid`.
2. O log traz `planId`. O `err.message` diz o que o cálculo recusou.

## Como resolver
Acionar o time responsável para ajustar o price no gateway ou o plano no catálogo. O cliente não tem ação.

## Quando escalar
Sempre que aparecer em plano ofertado. Anexe: `planId` e o `err`.
