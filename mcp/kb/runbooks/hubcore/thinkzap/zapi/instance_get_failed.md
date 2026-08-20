---
category: integration
audience: suporte
summary: Ler os dados de uma linha na z-api falhou.
---
# thinkzap.zapi.instance_get_failed

## O que significa
O app thinkzap pediu à z-api os dados de uma linha de WhatsApp específica e a z-api recusou ou não respondeu. Por isso os dados dessa linha não puderam ser carregados. É uma falha na integração externa com a z-api, normalmente passageira ou ligada a instabilidade do serviço.

## Causa provável
- **Instabilidade da z-api**: o serviço estava indisponível ou lento no momento.
- **Linha inexistente na z-api**: a linha consultada pode não existir mais na z-api.
- **Status ou credenciais da z-api**: a conta na z-api pode estar com problema de status ou credencial.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.zapi.instance_get_failed`.
3. Leia na linha do log o status e a mensagem devolvidos pela z-api.

## Como resolver
1. Peça ao parceiro para tentar novamente em alguns instantes.
2. Se persistir, verifique o status da z-api usando a mensagem do log como pista.
3. Após a z-api normalizar, peça para repetir a operação e confirme na tela de Logs que o erro não aparece mais.

## Quando escalar
Se a leitura continuar falhando mesmo com a z-api aparentemente normal, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.zapi.instance_get_failed`, domínio do parceiro, o horário do evento e a mensagem/status devolvidos pela z-api.
