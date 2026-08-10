---
category: internal
audience: dev
summary: Observabilidade — uma citação de mensagem não foi resolvida; a mensagem seguiu sem a citação.
---
# thinkzap.bitrix.reply_context_failed

## O que significa
Evento de observabilidade. Ao processar uma mensagem que respondia (citava) outra, o app thinkzap não conseguiu resolver o contexto da mensagem citada. A mensagem foi entregue normalmente, apenas sem a citação anexada. Não há impacto de atendimento nem perda de mensagem.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.bitrix.reply_context_failed`.
3. Leia na linha do log qual mensagem citada não pôde ser resolvida.

Não requer ação de suporte.
