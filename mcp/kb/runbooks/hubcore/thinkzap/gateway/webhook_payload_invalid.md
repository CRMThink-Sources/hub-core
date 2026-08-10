---
category: validation
audience: suporte
summary: Um evento de pagamento chegou em formato que não pôde ser verificado.
---
# thinkzap.gateway.webhook_payload_invalid

## O que significa
O gateway de pagamento (hoje o Stripe) avisa o app thinkzap sobre eventos de cobrança por meio de um webhook. Este erro indica que o evento chegou em um formato que não pôde ser lido nem verificado — normalmente porque a rota do webhook não está registrada corretamente. É um problema de configuração da rota, não uma ação do cliente.

## Causa provável
- **Rota do webhook mal registrada**: o gateway está enviando os eventos para um endereço ou formato que o app thinkzap não reconhece.
- **Configuração de webhook desatualizada** no painel do gateway.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.gateway.webhook_payload_invalid`.
3. Confirme que o evento recusado é um evento de pagamento vindo do gateway.

## Como resolver
1. Como é problema de configuração, acione o time responsável para revisar o registro da rota do webhook do gateway de pagamento.
2. Deixe claro que não há ação do cliente: ele não precisa refazer pagamento nem alterar nada.
3. Após a correção do registro, confirme na tela de Logs que novos eventos de pagamento passam a ser lidos corretamente.

## Quando escalar
Este erro já aponta para revisão do registro da rota pelo time responsável. Se a rota estiver correta e o erro persistir, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.gateway.webhook_payload_invalid`, domínio do parceiro, horário do evento e os ids envolvidos.
