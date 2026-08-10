---
category: validation
audience: suporte
summary: O plano escolhido não está disponível para esta linha.
---
# thinkzap.subscription.plan_not_offerable

## O que significa
O parceiro tentou contratar um plano que, no momento da escolha, não está ofertável para esta linha. Pode ser que a lista de planos exibida esteja desatualizada em relação ao que a linha aceita. A contratação não segue com esse plano. Não é cobrança indevida: nada foi cobrado, apenas a seleção não foi aceita.

## Causa provável
- **Lista de planos desatualizada**: a tela mostrou uma opção que já não vale para esta linha.
- **Plano incompatível com a linha**: o plano escolhido não corresponde ao tipo/estado desta linha.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.subscription.plan_not_offerable`.
3. Veja no log qual plano foi tentado e para qual linha.

## Como resolver
1. Oriente o parceiro a recarregar a tela de planos para atualizar a lista de opções.
2. Peça para escolher novamente entre os planos exibidos após o recarregamento.
3. Confirme na tela de Logs que o erro não aparece mais.

## Quando escalar
Se, mesmo após recarregar, nenhum plano válido aparecer ou o erro persistir, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.subscription.plan_not_offerable`, domínio do parceiro, o horário do evento, o identificador da linha e o plano tentado.
