---
category: integration
audience: dev
summary: Observabilidade — o gateway não informou o período de cobrança de uma assinatura.
---
# thinkzap.gateway.period_missing

## O que significa
Ao normalizar um evento de assinatura vindo do gateway de pagamento, o período de cobrança (início/fim do ciclo) não veio informado. É um registro de observabilidade: o fluxo segue, não há ação de suporte. Não requer ação de suporte.

## Como verificar
1. Filtre os logs pelo `traceKey` do evento.
2. Confirme `código de erro: thinkzap.gateway.period_missing`.
3. Inspecione o payload do evento de assinatura recebido do gateway e verifique quais campos de período vieram ausentes.

Não requer ação de suporte. Se recorrente, reconciliar o evento diretamente no gateway.
