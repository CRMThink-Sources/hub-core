---
category: integration
audience: suporte
summary: A z-api não respondeu à listagem de linhas de WhatsApp.
---
# thinkzap.zapi.instance_list_failed

## O que significa
O app thinkzap pediu à z-api a lista das linhas de WhatsApp e a z-api recusou ou não respondeu. Por isso a listagem não pôde ser montada. É uma falha na integração externa com a z-api, normalmente passageira ou ligada a instabilidade do serviço.

## Causa provável
- **Instabilidade da z-api**: o serviço estava indisponível ou lento no momento.
- **Status ou credenciais da z-api**: a conta na z-api pode estar com problema de status ou credencial.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.zapi.instance_list_failed`.
3. Leia na linha do log o status e a mensagem devolvidos pela z-api.

## Como resolver
1. Peça ao parceiro para recarregar a tela em alguns instantes (o erro costuma ser passageiro).
2. Se persistir, verifique o status da z-api e se as credenciais estão em ordem, usando a mensagem do log como pista.
3. Após a z-api normalizar, peça para recarregar a lista e confirme na tela de Logs que o erro não aparece mais.

## Quando escalar
Se a listagem continuar falhando mesmo com a z-api aparentemente normal, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.zapi.instance_list_failed`, domínio do parceiro, o horário do evento e a mensagem/status devolvidos pela z-api.
