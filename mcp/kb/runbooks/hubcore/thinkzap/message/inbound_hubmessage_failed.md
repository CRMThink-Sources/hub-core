---
category: integration
audience: suporte
summary: Uma mensagem recebida do WhatsApp Oficial não pôde ser entregue ao CRM.
---
# thinkzap.message.inbound_hubmessage_failed

## O que significa
Uma mensagem recebida no WhatsApp Oficial (canal HubMessage) não pôde ser entregue ao CRM. A mensagem chegou até o app thinkzap, mas o repasse para o CRM falhou. Como é retentável, o app reprocessa automaticamente; o erro isolado costuma não deixar mensagem perdida.

## Causa provável
- **Instabilidade momentânea**: uma falha passageira no repasse ao CRM.
- **Canal HubMessage com problema**: o canal do WhatsApp Oficial oscilou no momento do recebimento.
- **Instalação do app**: se recorrente, pode indicar problema de permissões ou instalação do app no portal.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.message.inbound_hubmessage_failed`.
3. Verifique se é um caso isolado (reprocessa sozinho) ou recorrente, e leia a mensagem devolvida no log.

## Como resolver
1. Se for isolado, aguarde o reprocessamento automático e confirme com o parceiro que a mensagem chegou ao CRM.
2. Se for recorrente, confira o status do canal HubMessage (WhatsApp Oficial) e se o app está instalado/autorizado corretamente no portal.
3. Após normalizar, confirme na tela de Logs que o erro não aparece mais.

## Quando escalar
Se o erro é recorrente mesmo com o canal HubMessage em ordem e o app instalado, e mensagens estão deixando de chegar ao CRM, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.message.inbound_hubmessage_failed`, domínio/portal do parceiro, horário do evento, e-mail da conta e o id da linha/canal.
