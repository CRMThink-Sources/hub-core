---
category: config
audience: suporte
summary: A verificação de eventos de pagamento não está configurada.
---
# thinkzap.gateway.webhook_secret_missing

## O que significa
O gateway de pagamento (hoje o Stripe) avisa o app thinkzap sobre cada evento de cobrança (pagamento aprovado, assinatura alterada) por meio de um webhook. Para provar que o aviso veio mesmo do gateway, é preciso um segredo de verificação. Este erro indica que esse segredo não está configurado, então os eventos de pagamento não podem ser verificados e são recusados. É um problema de configuração do webhook, não uma ação do cliente.

## Causa provável
- **Segredo do webhook ausente**: o segredo de verificação dos eventos do gateway ainda não foi cadastrado.
- **Configuração removida ou salva pela metade**.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.gateway.webhook_secret_missing`.
3. Confirme que o evento recusado é um evento de pagamento vindo do gateway.

## Como resolver
1. Como é uma configuração ausente, acione o time responsável para configurar o segredo do webhook do gateway de pagamento.
2. Deixe claro que não há ação do cliente: o cliente não precisa refazer pagamento nem alterar nada.
3. Após a configuração, confirme na tela de Logs que novos eventos de pagamento passam a ser aceitos.

## Quando escalar
Este erro já é um pedido ao time responsável para configurar o segredo do webhook. Se após a configuração o erro persistir, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.gateway.webhook_secret_missing`, domínio do parceiro, horário do evento e os ids envolvidos.
