---
category: internal
audience: dev
summary: Observabilidade — o aviso de janela fechada não foi postado no chat.
---
# thinkzap.hubmessage.notify_failed

## O que significa
Registro de observabilidade. Quando a janela de 24h do WhatsApp Oficial está fechada, o app thinkzap tenta postar um aviso no chat para o operador. Este código indica apenas que esse aviso não foi postado — a mensagem original e o fluxo do operador não são afetados. Não requer ação de suporte.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.hubmessage.notify_failed`.
3. Leia o motivo registrado na linha do log para fins de diagnóstico.

Não requer ação de suporte. Se aparecer de forma recorrente, encaminhe para a equipe de desenvolvimento avaliar a observabilidade, anexando `traceKey`, código de erro e horário.
