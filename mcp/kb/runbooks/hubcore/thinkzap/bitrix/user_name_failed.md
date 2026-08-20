---
category: internal
audience: dev
summary: Observabilidade — o nome de exibição de um usuário do Bitrix24 não foi obtido; usado um fallback.
---
# thinkzap.bitrix.user_name_failed

## O que significa
Evento de observabilidade. O app thinkzap não conseguiu obter o nome de exibição de um usuário do Bitrix24 e usou um valor de fallback no lugar. A operação seguiu normalmente; o único efeito é o nome exibido não ser o ideal.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.bitrix.user_name_failed`.
3. Leia na linha do log qual usuário do Bitrix24 não teve o nome resolvido.

Não requer ação de suporte.
