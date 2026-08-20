---
category: integration
audience: dev
summary: Observabilidade — a desconexão de uma linha com teste vencido falhou; será retentada.
---
# thinkzap.provisioning.disconnect_expired_failed

## O que significa
Evento de observabilidade. A rotina que desconecta automaticamente linhas com o período de teste vencido falhou para uma linha. Como a operação é retentável, ela será tentada de novo automaticamente. Não há ação de atendimento envolvida.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.provisioning.disconnect_expired_failed`.
3. Leia na linha do log qual linha (com teste vencido) não pôde ser desconectada.

Não requer ação de suporte.
