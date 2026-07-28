---
category: integration
audience: suporte
summary: O pedido chegou até a Clicksign, mas ela respondeu com erro e não cancelou.
---
# clicksign.document.cancel_failed

## O que significa
Dessa vez o pedido de cancelamento passou por todas as etapas internas do CRMThink e chegou de fato até a Clicksign. Só que a Clicksign, ao receber o pedido, respondeu com um erro e não cancelou o documento. Ou seja, o problema não está do nosso lado nem na configuração — está na resposta que a própria Clicksign devolveu. O documento continua no estado em que estava.

## Causa provável
- **A Clicksign recusou o cancelamento**: normalmente porque o documento (o envelope, que é o pacote do documento na Clicksign) já está num estado que não permite cancelar — por exemplo já assinado ou finalizado — ou porque a conta usada não tem permissão pra essa ação.
- **Instabilidade momentânea na Clicksign**: um problema passageiro no serviço da Clicksign fez o pedido falhar mesmo estando tudo certo.

## Como verificar
1. Na tela de Logs do app clicksign, filtre pelo `traceKey` do ticket.
2. Confirme `errorCode: clicksign.document.cancel_failed`.
3. Leia a mensagem que a Clicksign devolveu, registrada no log — é ela que diz o motivo real da recusa e guia o próximo passo.

## Como resolver
1. Peça ao parceiro pra conferir no painel da Clicksign o estado atual do envelope, porque o motivo mais comum é o documento já estar num estado que impede o cancelamento.
2. Use a mensagem de erro da Clicksign no log pra entender o porquê: se ela indica que o documento já foi assinado/finalizado, o cancelamento realmente não se aplica; se aponta permissão, o problema é de acesso da conta.
3. Se a mensagem sugerir algo passageiro, peça ao parceiro pra refazer o cancelamento pela timeline do negócio, já que uma instabilidade momentânea costuma se resolver na nova tentativa.

## Quando escalar
Se o erro repetir após nova tentativa e a mensagem da Clicksign não indicar um motivo tratável pelo parceiro, acione a equipe de desenvolvimento. Anexe: `traceKey`, `errorCode: clicksign.document.cancel_failed`, domínio do parceiro, o horário do evento e a mensagem devolvida pela Clicksign.
