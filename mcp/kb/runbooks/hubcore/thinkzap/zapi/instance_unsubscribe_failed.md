---
category: integration
audience: suporte
summary: Cancelar a assinatura da linha na z-api falhou.
---
# thinkzap.zapi.instance_unsubscribe_failed

## O que significa
O app thinkzap pediu à z-api para cancelar a assinatura de uma linha, porque a linha ou a assinatura do cliente foi cancelada no CRM. A z-api recusou ou não respondeu esse pedido. Enquanto o cancelamento não acontecer, a linha continua sendo cobrada da CRMThink pela z-api. É uma falha na integração externa com a z-api, normalmente passageira.

## Causa provável
- **Instabilidade da z-api**: o serviço estava indisponível ou lento.
- **Instância inexistente ou credencial inválida**: a instância foi apagada na z-api ou o token gravado na linha não confere.
- **Status da z-api**: a conta na z-api pode estar com problema de status.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.zapi.instance_unsubscribe_failed`.
3. Leia na linha do log o status e a mensagem devolvidos pela z-api.

## Como resolver
1. O sistema tenta de novo sozinho algumas vezes. Aguarde alguns minutos e confira se um novo log de sucesso apareceu.
2. Se as tentativas se esgotaram, edite qualquer campo da assinatura no CRM para disparar o cancelamento de novo.
3. Se persistir, cancele a assinatura da instância diretamente no painel da z-api, usando a mensagem do log como pista.

## Quando escalar
Se o erro continuar com a z-api normal, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.zapi.instance_unsubscribe_failed`, domínio do parceiro, o id da instância, o horário do evento e a mensagem/status devolvidos pela z-api.
