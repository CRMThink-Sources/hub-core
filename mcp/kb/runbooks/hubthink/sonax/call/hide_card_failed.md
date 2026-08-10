---
category: integration
audience: suporte
summary: Falha ao ocultar o card da chamada no Bitrix24 ao encerrar, então o card pode ter ficado aberto.
---
# sonax.call.hide_card_failed

## O que significa
Durante uma ligação, o Bitrix24 mostra um card da chamada na tela. Ao encerrar, o Sonax pede para ocultar esse card.

Esse erro quer dizer que o pedido para ocultar o card falhou, e ele pode ter ficado aberto na tela do usuário. Costuma ser uma falha momentânea e normalmente se resolve na próxima sincronização.

## Causa provável
- **Instabilidade momentânea** do Bitrix24 ao encerrar a chamada.
- **Falha temporária de comunicação** com o portal no momento de ocultar o card.
- **Card já fechado ou alterado** manualmente pelo usuário.

## Como verificar
1. Na tela de Logs do app sonax, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: sonax.call.hide_card_failed`.
3. Verifique se o parceiro relata cards de chamada ficando presos abertos na tela.

## Como resolver
1. Na maioria dos casos, o card se ajusta sozinho na próxima sincronização — nenhuma ação é necessária.
2. Se um card ficou aberto, o usuário pode fechá-lo manualmente.
3. Acompanhe se o problema se repete para o mesmo usuário ou portal.

## Quando escalar
Escale se os cards de chamada ficam presos abertos com frequência e não se ajustam sozinhos. Acione a equipe de desenvolvimento e anexe: `traceKey`, `código de erro: sonax.call.hide_card_failed`, domínio do parceiro e o horário do evento.
