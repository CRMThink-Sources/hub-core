---
category: integration
audience: suporte
summary: O bot não conseguiu encerrar a sessão do canal aberto.
---
# thinkzap.bot.finish_failed

## O que significa
O fluxo chegou ao fim e o bot tentou fechar a conversa no Bitrix24, mas o pedido foi recusado. **Impacto pequeno**: o fluxo já terminou e o cliente já recebeu a última mensagem. A conversa apenas fica marcada como aberta por mais tempo — a própria linha a fecha pelo tempo de inatividade configurado nela.

## Causa provável
- **Sessão já fechada**: o operador ou o próprio Bitrix24 encerrou a conversa antes.
- **Instabilidade momentânea**: o Bitrix24 não respondeu na hora.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.bot.finish_failed` e anote o `chatId`.
3. Abra a conversa no Bitrix24 e veja se ela está aberta ou já foi fechada.

## Como resolver
1. Nenhuma ação imediata é necessária: a conversa fecha pelo tempo de inatividade da linha.
2. Se o parceiro precisar fechar na hora, um operador pode encerrar a conversa manualmente no Bitrix24.
3. Se o volume desses avisos for alto, confirme com o parceiro o tempo de inatividade configurado no canal aberto.

## Quando escalar
Só escale se o aviso aparecer em praticamente toda conversa atendida pelo bot — nesse caso pode haver problema de permissão do app. Acione a equipe de desenvolvimento anexando: `traceKey`, `código de erro: thinkzap.bot.finish_failed`, `chatId`, domínio/portal do parceiro, horário do evento e a mensagem devolvida pelo Bitrix24.
