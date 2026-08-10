---
category: integration
audience: suporte
summary: O WhatsApp Oficial (HubMessage) recusou ou não respondeu.
---
# thinkzap.hubmessage.request_failed

## O que significa
O app thinkzap enviou um pedido ao canal do WhatsApp Oficial (HubMessage), mas o canal recusou o pedido ou não respondeu a tempo. O problema está na comunicação com o WhatsApp Oficial, não em dado faltando do lado do parceiro. Por ser uma instabilidade de integração, costuma ser passageiro.

## Causa provável
- **Instabilidade momentânea** do canal HubMessage / WhatsApp Oficial.
- **Credencial com problema**: a credencial do canal está vencida, revogada ou incorreta, e por isso o canal recusa o pedido.
- **Lentidão de rede**: o canal demorou demais e a requisição expirou.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.hubmessage.request_failed`.
3. Leia, na linha do log, a resposta que o canal HubMessage devolveu — ela costuma indicar se foi recusa (credencial/permissão) ou falta de resposta (instabilidade).

## Como resolver
1. Por ser um erro passageiro, oriente o parceiro a reenviar em instantes.
2. Se persistir, verifique o status e as credenciais do canal HubMessage — a recusa recorrente aponta para credencial vencida ou revogada.
3. Confirme na tela de Logs que o erro deixou de aparecer após o reenvio.

## Quando escalar
Se o reenvio continuar falhando e o status/credenciais do canal HubMessage estiverem corretos, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.hubmessage.request_failed`, domínio do parceiro, horário do evento e os ids envolvidos.
