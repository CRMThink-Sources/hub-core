---
category: integration
audience: suporte
summary: A mensagem do operador não foi entregue ao contato pelo WhatsApp Oficial.
---
# thinkzap.hubmessage.send_failed

## O que significa
O operador enviou uma mensagem pelo WhatsApp Oficial, mas ela não foi entregue ao contato. A falha ocorreu no transporte pelo canal HubMessage. O envio é retentado automaticamente, então em muitos casos a mensagem acaba saindo sem intervenção.

## Causa provável
- **Instabilidade momentânea** do canal HubMessage / WhatsApp Oficial.
- **Contato inválido ou fora do WhatsApp**: o número não recebe pelo WhatsApp Oficial.
- **Problema no canal**: credencial ou configuração do canal HubMessage com falha.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.hubmessage.send_failed`.
3. Leia, na linha do log, o motivo devolvido pelo canal e confirme se a mensagem foi ou não entregue em uma retentativa posterior.

## Como resolver
1. Como o envio é retentado automaticamente, aguarde e verifique se a mensagem foi entregue em seguida.
2. Se não sair, confira o número do contato e se ele de fato usa WhatsApp.
3. Se o problema persistir para vários contatos, verifique o status do canal HubMessage.

## Quando escalar
Se as retentativas não entregarem a mensagem e o número e o canal HubMessage estiverem corretos, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.hubmessage.send_failed`, domínio do parceiro, horário do evento e os ids envolvidos.
