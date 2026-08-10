---
category: integration
audience: suporte
summary: Não foi possível montar a lista de contatos relacionados.
---
# thinkzap.message.related_destinations_failed

## O que significa
Ao preparar o envio, o app thinkzap tenta montar a lista de contatos relacionados (destinos sugeridos a partir do CRM do Bitrix24). Este erro indica que essa lista não pôde ser montada. O envio em si ainda pode ser feito informando o destino manualmente — o que falhou foi a sugestão automática de contatos.

## Causa provável
- **Permissões de CRM do app no Bitrix24**: falta o escopo de CRM necessário para consultar os contatos relacionados.
- **Instabilidade momentânea**: o Bitrix24 não respondeu a consulta na hora.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.message.related_destinations_failed`.
3. Leia na linha do log a mensagem devolvida — indica se foi falta de permissão de CRM ou falha passageira.

## Como resolver
1. Como alternativa imediata, oriente o parceiro a informar o destino manualmente para não travar o envio.
2. Confirme que o app tem as permissões de CRM necessárias no Bitrix24; se faltarem, oriente a reinstalar/reautorizar com os escopos completos.
3. Após ajustar as permissões, peça para repetir e confirme na tela de Logs que a lista volta a ser montada.

## Quando escalar
Se as permissões de CRM estão corretas e a lista de relacionados continua falhando, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.message.related_destinations_failed`, domínio/portal do parceiro, horário do evento, e-mail da conta e os ids envolvidos.
