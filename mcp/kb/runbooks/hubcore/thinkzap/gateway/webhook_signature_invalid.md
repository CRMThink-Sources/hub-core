---
category: auth
audience: suporte
summary: Um evento de pagamento foi recusado por não ter origem verificável.
---
# thinkzap.gateway.webhook_signature_invalid

## O que significa
O gateway de pagamento (hoje o Stripe) avisa o app thinkzap sobre cada evento de cobrança por meio de um webhook, e junto do aviso vem uma assinatura de segurança que prova que ele veio mesmo do gateway. Este erro indica que essa assinatura não conferiu, então o evento foi recusado por precaução. É um problema de configuração do webhook, não uma ação do cliente.

## Causa provável
- **Segredo diferente entre os dois lados** (mais comum): o segredo cadastrado no app thinkzap não é o mesmo configurado no painel do gateway.
- **Segredo colado com sujeira**: um espaço ou quebra de linha a mais quebra a conferência.
- **Ambiente errado**: webhook de teste apontando para produção, ou o contrário.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.gateway.webhook_signature_invalid`.
3. Confirme que o evento recusado é um evento de pagamento vindo do gateway.

## Como resolver
1. Como é problema de configuração, peça ao time responsável para comparar o segredo do webhook cadastrado com o do painel do gateway de pagamento — eles precisam ser idênticos.
2. Oriente a copiar o segredo de novo do painel do gateway e colá-lo sem espaços nas pontas, garantindo o mesmo ambiente (teste ou produção) dos dois lados.
3. Deixe claro que não há ação do cliente: ele não precisa refazer pagamento.

## Quando escalar
Se o segredo estiver comprovadamente igual nos dois lados e no mesmo ambiente e o erro continuar, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.gateway.webhook_signature_invalid`, domínio do parceiro, horário do evento e os ids envolvidos.
