---
category: integration
audience: suporte
summary: O preço de um plano não pôde ser lido no gateway de pagamento; o plano ficou fora da oferta ou aparece sem valor.
---
# thinkzap.gateway.price_read_failed

## O que significa
O preço de um plano não pôde ser lido no gateway de pagamento (hoje Stripe). O efeito depende da tela:
- na **contratação**, o plano não é oferecido;
- no **estado da assinatura**, o plano aparece sem valor.

Nenhuma cobrança é afetada.

## Causa provável
- **Price arquivado ou apagado** no gateway, com o plano do catálogo ainda apontando para ele.
- **Chave do gateway sem permissão** de leitura.
- **Instabilidade do gateway**.

## Como verificar
1. Filtre os Logs e confirme `código de erro: thinkzap.gateway.price_read_failed`.
2. O log traz `priceId` (e `planId` na contratação).
3. Procure o price no painel do gateway.

## Como resolver
1. Price inexistente ou arquivado: acionar o time responsável para corrigir o `gatewayId` do plano no catálogo.
2. Instabilidade: recarregar em instantes.

## Quando escalar
Se o price existe e está ativo e a leitura falha sempre. Anexe: `priceId`, `planId` e o `err`.
