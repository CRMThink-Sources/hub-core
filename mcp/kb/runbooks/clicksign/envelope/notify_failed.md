---
category: integration
audience: suporte
summary: O documento foi criado, mas o aviso para os assinantes não saiu.
---
# clicksign.envelope.notify_failed

## O que significa
Aqui o documento deu certo: foi enviado à Clicksign e o envelope foi criado normalmente. O que falhou foi só o aviso — o e-mail que a Clicksign manda para os assinantes chamando-os para assinar. Na prática, o documento existe e está esperando assinatura, mas quem precisa assinar pode não ter sido avisado. Por isso este erro não impede o processo, só atrasa.

## Causa provável
- **Instabilidade momentânea na Clicksign**: houve uma falha passageira no serviço da Clicksign bem na hora de disparar o aviso.
- **Contato do assinante inválido**: o e-mail cadastrado do assinante está errado, então o aviso não tem para onde ir.

## Como verificar
1. Na tela de Logs do app clicksign, filtre pelo `traceKey` do ticket.
2. Confirme `errorCode: clicksign.envelope.notify_failed`.
3. Peça ao parceiro para abrir o painel da Clicksign, localizar o envelope e ver o status das notificações — assim você sabe quais assinantes ficaram sem aviso.

## Como resolver
1. Oriente o parceiro a abrir o envelope do documento no painel da Clicksign.
2. Peça que ele reenvie a notificação aos assinantes pelo próprio painel da Clicksign — como o envelope já existe, basta reenviar o aviso, não é preciso criar tudo de novo.
3. Peça que ele confira se os e-mails dos assinantes estão corretos; um e-mail errado faz o aviso falhar de novo.

## Quando escalar
Se a notificação continua falhando mesmo ao reenviar pelo painel da Clicksign, acione a equipe de desenvolvimento. Anexe: `traceKey`, `errorCode: clicksign.envelope.notify_failed`, domínio do parceiro, o horário do evento e o identificador do envelope.
