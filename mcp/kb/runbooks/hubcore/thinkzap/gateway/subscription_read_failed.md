---
category: integration
audience: suporte
summary: A assinatura não pôde ser lida no gateway de pagamento; a tela mostra só o período vigente, sem valores.
---
# thinkzap.gateway.subscription_read_failed

## O que significa
A assinatura da instalação não pôde ser lida no gateway de pagamento. A tela de assinatura mostra só o período vigente, sem a composição por plano e sem valores. O acesso às linhas não é afetado, porque ele vem do CRM.

## Causa provável
- **Assinatura cancelada ou apagada** no gateway com o contrato ainda ativo no CRM.
- **Instabilidade do gateway**.

## Como verificar
1. Filtre os Logs e confirme `código de erro: thinkzap.gateway.subscription_read_failed`.
2. O log traz `gatewaySubscriptionId`. Procure-o no painel do gateway.

## Como resolver
1. Assinatura inexistente no gateway: reconciliar o contrato no CRM (o `gatewayId` está errado ou a assinatura foi cancelada).
2. Instabilidade: recarregar em instantes.

## Quando escalar
Se a assinatura existe e a leitura falha sempre. Anexe: `gatewaySubscriptionId` e o `err`.
