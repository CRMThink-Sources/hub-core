---
category: integration
audience: suporte
summary: Atualizar os dados da linha na z-api falhou.
---
# thinkzap.zapi.instance_update_failed

## O que significa
O app thinkzap pediu à z-api para atualizar os dados de configuração de uma linha de WhatsApp e a z-api recusou ou não respondeu. A alteração não foi aplicada na z-api. É uma falha na integração externa, geralmente passageira ou ligada a instabilidade do serviço.

## Causa provável
- **Instabilidade da z-api**: o serviço estava indisponível ou lento no momento.
- **Linha desconectada**: a linha pode estar desconectada, atrapalhando a atualização.
- **Status da z-api**: a conta na z-api pode estar com problema de status.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.zapi.instance_update_failed`.
3. Leia na linha do log o status e a mensagem devolvidos pela z-api.

## Como resolver
1. Peça ao parceiro para tentar salvar/atualizar novamente em alguns instantes.
2. Verifique na aba Conexão se a linha está conectada; se não estiver, oriente a reconectar lendo o QR Code.
3. Se persistir, verifique o status da z-api usando a mensagem do log e repita a operação depois que normalizar.

## Quando escalar
Se a atualização continuar falhando mesmo com a linha conectada e a z-api normal, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.zapi.instance_update_failed`, domínio do parceiro, o horário do evento e a mensagem/status devolvidos pela z-api.
