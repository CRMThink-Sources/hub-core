---
category: internal
audience: dev
summary: Observabilidade — evento de pagamento ignorado por não trazer dados suficientes.
---
# thinkzap.gateway.event_ignored

## O que significa
Registro de observabilidade. O gateway de pagamento enviou um evento que o app thinkzap optou por ignorar porque não trazia dados suficientes para processar. É um desfecho esperado para certos eventos e não indica falha de cobrança. Não requer ação de suporte.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.gateway.event_ignored`.
3. Leia, na linha do log, qual evento foi ignorado e o motivo, para fins de diagnóstico.

Não requer ação de suporte. Se aparecer de forma recorrente ou associado a uma cobrança que não foi processada, encaminhe para a equipe de desenvolvimento, anexando `traceKey`, código de erro e horário.
