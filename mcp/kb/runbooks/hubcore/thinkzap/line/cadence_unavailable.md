---
category: validation
audience: suporte
summary: O Cadenciador ainda não está liberado para esta instalação.
---
# thinkzap.line.cadence_unavailable

## O que significa
O parceiro tentou ativar o Cadenciador, mas o recurso ainda está sendo liberado aos poucos e não foi ligado para esta instalação. Nada foi gravado. Não é falha técnica.

## Causa provável
- **Liberação gradual**: o Cadenciador depende do novo caminho de envio de mensagens, que é ligado instalação por instalação.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.line.cadence_unavailable`.
3. Na aba Limites de envio, o card Cadenciador mostra que o recurso não está disponível.

## Como resolver
1. Explique que o recurso está em liberação e que o limite diário continua disponível na mesma aba.
2. Se o parceiro precisar do recurso com urgência, registre o pedido com o domínio do parceiro.

## Quando escalar
Se a instalação já deveria ter o recurso liberado, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.line.cadence_unavailable`, domínio do parceiro e o horário do evento.
