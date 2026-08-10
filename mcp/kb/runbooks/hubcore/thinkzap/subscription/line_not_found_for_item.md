---
category: validation
audience: suporte
summary: A linha informada não foi encontrada nesta instalação.
---
# thinkzap.subscription.line_not_found_for_item

## O que significa
A operação fazia referência a uma linha que não foi encontrada nesta instalação do app thinkzap. Pode ser uma linha que foi removida, uma lista desatualizada na tela, ou uma assinatura que não está mais ativa. Não é uma falha de integração — é uma referência que não bate com o que existe hoje.

## Causa provável
- **Lista desatualizada**: a tela ainda mostrava uma linha que já não existe.
- **Linha removida**: a linha foi excluída e a ação tentou usá-la mesmo assim.
- **Assinatura inativa**: a assinatura que continha a linha não está mais ativa.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.subscription.line_not_found_for_item`.
3. Leia na linha do log qual linha/item foi referenciado e o portal/conta envolvidos.

## Como resolver
1. Peça ao parceiro para recarregar a lista de linhas e tentar a operação novamente com uma linha existente.
2. Se a linha realmente sumiu, verifique se a assinatura está ativa — se não estiver, o caminho é regularizar a assinatura.
3. Confirme na tela de Logs que a operação, refeita com uma linha válida, não gera mais o erro.

## Quando escalar
Se a linha aparece na lista atualizada, a assinatura está ativa e mesmo assim a operação diz que a linha não existe, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.subscription.line_not_found_for_item`, domínio/portal do parceiro, horário do evento, e-mail da conta e o id da linha/item referenciado.
