---
category: integration
audience: suporte
summary: Consultar o status de conexão da linha na z-api falhou.
---
# thinkzap.zapi.instance_status_failed

## O que significa
O app thinkzap perguntou à z-api qual o status de conexão de uma linha de WhatsApp (se está conectada, aguardando QR Code etc.) e a z-api recusou ou não respondeu. Por isso o status não pôde ser exibido. É uma falha na integração externa com a z-api, normalmente passageira ou ligada a instabilidade do serviço.

## Causa provável
- **Instabilidade da z-api**: o serviço estava indisponível ou lento no momento.
- **Status ou credenciais da z-api**: a conta na z-api pode estar com problema de status ou credencial.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.zapi.instance_status_failed`.
3. Leia na linha do log o status e a mensagem devolvidos pela z-api.

## Como resolver
1. Peça ao parceiro para recarregar a aba Conexão em alguns instantes.
2. Se persistir, verifique o status da z-api usando a mensagem do log como pista.
3. Após a z-api normalizar, peça para recarregar e confirme na tela de Logs que o erro não aparece mais.

## Quando escalar
Se a consulta de status continuar falhando mesmo com a z-api aparentemente normal, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.zapi.instance_status_failed`, domínio do parceiro, o horário do evento e a mensagem/status devolvidos pela z-api.
