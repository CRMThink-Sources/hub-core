---
category: validation
audience: suporte
summary: O envio de botões da tela do canal aberto não pôde ser entregue ao provider.
---
# thinkzap.message.button_action_failed

## O que significa
A tela de botões do widget do canal aberto do Bitrix posta o envio como uma mensagem especial no chat, e é o processador de saída do app thinkzap quem entende essa mensagem e manda o WhatsApp com botões pro contato. Este erro indica que o processador recebeu essa mensagem especial, mas não conseguiu chegar a chamar o provider — por um dos dois motivos abaixo, ambos permanentes (retentativa não resolve). O operador é avisado no próprio chat do canal aberto sobre a falha.

## Causa provável
- **Tipo de botão não aceito pela linha**: a linha do WhatsApp Oficial só aceita botão de link ou ligação — sem resposta rápida. A linha não-oficial aceita os três tipos, mas não misturados no mesmo envio.
- **Mensagem corrompida**: a mensagem especial que a tela do canal aberto posta chegou incompleta ou corrompida — situação rara, geralmente ligada a uma versão desatualizada do widget.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.message.button_action_failed`.
3. Leia na linha do log qual dos dois motivos ocorreu e qual linha estava em uso.
4. O chat do canal aberto onde o envio foi tentado tem um aviso do bot explicando o motivo.

## Como resolver
1. Se foi tipo de botão: oriente o parceiro a reabrir a tela de botões do canal aberto e ajustar os tipos conforme a linha (oficial: só link/ligação; não-oficial: sem misturar resposta rápida com os outros).
2. Se foi mensagem corrompida: peça para o parceiro recarregar a página do Bitrix24 e tentar de novo pela tela de botões.

## Quando escalar
Se os botões preenchidos são do tipo certo para a linha e o erro persistir, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.message.button_action_failed`, domínio/portal do parceiro, horário do evento e a linha usada.
