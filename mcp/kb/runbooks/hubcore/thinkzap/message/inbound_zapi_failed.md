---
category: integration
audience: suporte
summary: Uma mensagem recebida do WhatsApp não pôde ser entregue ao CRM.
---
# thinkzap.message.inbound_zapi_failed

## O que significa
Uma mensagem recebida no WhatsApp (linha não-oficial, via z-api) não pôde ser entregue ao CRM. A mensagem chegou até o app thinkzap, mas o repasse para o CRM falhou. Como é retentável, o app reprocessa automaticamente; o erro isolado costuma não deixar mensagem perdida.

## Causa provável
- **Instabilidade momentânea**: uma falha passageira no repasse ao CRM.
- **Linha com problema de conexão**: a linha oscilou no momento do recebimento.
- **Instalação do app**: se recorrente, pode indicar problema de permissões ou instalação do app no portal.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.message.inbound_zapi_failed`.
3. Verifique se é um caso isolado (reprocessa sozinho) ou recorrente, e leia a mensagem devolvida no log.

## Como resolver
1. Se for isolado, aguarde o reprocessamento automático e confirme com o parceiro que a mensagem chegou ao CRM.
2. Se for recorrente, confira na aba Conexão se a linha está ativa e conectada e se o app está instalado/autorizado corretamente no portal.
3. Após normalizar, confirme na tela de Logs que o erro não aparece mais.

## Quando escalar
Se o erro é recorrente mesmo com a linha conectada e o app instalado, e mensagens estão deixando de chegar ao CRM, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.message.inbound_zapi_failed`, domínio/portal do parceiro, horário do evento, e-mail da conta e o id da linha.
