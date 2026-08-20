---
category: integration
audience: suporte
summary: Ativar ou desativar a assinatura da linha na z-api falhou.
---
# thinkzap.zapi.instance_subscribe_failed

## O que significa
O app thinkzap pediu à z-api para ativar ou desativar a assinatura de eventos da linha (o que permite receber e sincronizar as mensagens dessa linha). A z-api recusou ou não respondeu esse pedido. É uma falha na integração externa com a z-api, normalmente passageira ou ligada a instabilidade do serviço.

## Causa provável
- **Instabilidade da z-api**: o serviço estava indisponível ou lento.
- **Linha desconectada**: a linha de WhatsApp pode estar desconectada, o que atrapalha a operação.
- **Status da z-api**: a conta na z-api pode estar com problema de status.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.zapi.instance_subscribe_failed`.
3. Leia na linha do log o status e a mensagem devolvidos pela z-api.

## Como resolver
1. Peça ao parceiro para tentar novamente em alguns instantes.
2. Verifique na aba Conexão se a linha está conectada (WhatsApp conectado por QR Code); se não estiver, oriente a reconectar lendo o QR Code.
3. Se persistir, verifique o status da z-api usando a mensagem do log como pista e repita a operação depois que normalizar.

## Quando escalar
Se o erro continuar mesmo com a linha conectada e a z-api normal, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.zapi.instance_subscribe_failed`, domínio do parceiro, o horário do evento e a mensagem/status devolvidos pela z-api.
