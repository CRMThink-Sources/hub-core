---
category: validation
audience: suporte
summary: Esta conta ainda não tem nenhuma linha.
---
# thinkzap.subscription.no_line_to_extend

## O que significa
O parceiro tentou uma operação que parte de uma linha existente (como adicionar/estender), mas a conta ainda não tem nenhuma linha criada. Sem uma primeira linha, não há o que estender. Não é falha técnica nem cobrança indevida: é uma questão de ordem — a primeira linha nasce pelo período de teste.

## Causa provável
- **Conta sem nenhuma linha**: nunca foi criada uma primeira linha.
- **Período de teste ainda não iniciado**: o fluxo que cria a primeira linha não foi feito.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.subscription.no_line_to_extend`.
3. Confira que a conta não possui nenhuma linha cadastrada.

## Como resolver
1. Oriente o parceiro a iniciar pelo período de teste, que é o fluxo que cria a primeira linha.
2. Com a primeira linha criada, as operações que dependem de uma linha existente ficam disponíveis.
3. Confirme na tela de Logs que o erro não aparece mais.

## Quando escalar
Se a conta tiver linhas e ainda assim receber este erro, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.subscription.no_line_to_extend`, domínio do parceiro, o e-mail da conta e o horário do evento.
