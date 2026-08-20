---
category: integration
audience: suporte
summary: Desconectar a linha na z-api falhou.
---
# thinkzap.zapi.instance_disconnect_failed

## O que significa
O app thinkzap pediu à z-api para desconectar uma linha de WhatsApp e a z-api recusou ou não respondeu. Por isso a desconexão não foi concluída na z-api. É uma falha na integração externa com a z-api, normalmente passageira ou ligada a instabilidade do serviço.

## Causa provável
- **Instabilidade da z-api**: o serviço estava indisponível ou lento no momento.
- **Linha já desconectada**: a linha pode já estar em um estado que impede a operação.
- **Status da z-api**: a conta na z-api pode estar com problema de status.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.zapi.instance_disconnect_failed`.
3. Leia na linha do log o status e a mensagem devolvidos pela z-api.

## Como resolver
1. Peça ao parceiro para tentar desconectar novamente em alguns instantes.
2. Verifique na aba Conexão o estado atual da linha (pode já ter desconectado).
3. Se persistir, verifique o status da z-api usando a mensagem do log e repita a operação depois que normalizar.

## Quando escalar
Se a desconexão continuar falhando mesmo com a z-api aparentemente normal, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.zapi.instance_disconnect_failed`, domínio do parceiro, o horário do evento e a mensagem/status devolvidos pela z-api.
