---
category: integration
audience: suporte
summary: A Clicksign aceitou o pedido sem erro, mas o documento não ficou como cancelado.
---
# clicksign.document.cancel_not_confirmed

## O que significa
Aqui o pedido de cancelamento foi até a Clicksign e ela aceitou sem devolver nenhum erro. Mesmo assim, quando o CRMThink foi conferir o resultado, o documento (o envelope, que é o pacote do documento na Clicksign) não terminou com o status de "cancelado". É diferente de uma recusa: a operação passou, mas o resultado final não bateu com o esperado. Como o CRMThink não conseguiu confirmar o cancelamento, ele registra esse aviso pra que alguém verifique o que de fato aconteceu com o documento.

## Causa provável
- **Documento já assinado ou finalizado**: quando o envelope já chegou ao fim, o cancelamento não se aplica mais, então o status permanece o que era em vez de virar "cancelado".
- **Documento já cancelado antes**: o envelope já tinha sido cancelado numa ação anterior, então o pedido não mudou nada — o resultado já era o desejado.

## Como verificar
1. Na tela de Logs do app clicksign, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: clicksign.document.cancel_not_confirmed`.
3. Peça ao parceiro pra conferir no painel da Clicksign qual é o estado real do envelope — é essa checagem que explica por que o cancelamento não foi confirmado.

## Como resolver
1. Peça ao parceiro pra verificar no painel da Clicksign o estado atual do envelope, porque o estado real é o que diz se ainda há algo a fazer.
2. Se o envelope já estiver assinado ou finalizado, explique ao parceiro que o cancelamento não se aplica nesse caso — um documento concluído não pode mais ser cancelado.
3. Se o envelope já constar como cancelado, o objetivo já foi atingido: nada mais precisa ser feito, o aviso só refletiu que não havia o que cancelar.

## Quando escalar
Se o estado do envelope na Clicksign estiver inconsistente (nem cancelado, nem assinado/finalizado), acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: clicksign.document.cancel_not_confirmed`, domínio do parceiro e o horário do evento.
