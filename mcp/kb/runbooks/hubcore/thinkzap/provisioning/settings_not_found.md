---
category: internal
audience: dev
summary: Observabilidade — configurações da linha não encontradas; aplicados os padrões.
---
# thinkzap.provisioning.settings_not_found

## O que significa
Evento de observabilidade. O app thinkzap não encontrou as configurações específicas de uma linha e aplicou os valores padrão no lugar. A operação seguiu normalmente; na grande maioria dos casos não há impacto perceptível para o cliente.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.provisioning.settings_not_found`.
3. Leia na linha do log qual linha teve as configurações aplicadas por padrão.

Não requer ação de suporte, salvo se o cliente relatar mensagens sumindo — nesse caso, verificar a linha na lista.
