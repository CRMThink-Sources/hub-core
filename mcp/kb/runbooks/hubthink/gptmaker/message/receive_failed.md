---
category: integration
audience: suporte
summary: Uma mensagem recebida não foi processada pelo agente.
---
# gptmaker.message.receive_failed

## O que significa
Uma mensagem chegou no canal, mas não foi processada pelo agente. Aquela mensagem pode não ter gerado resposta.

## Causa provável
- Falha momentânea ao processar a mensagem recebida.
- Formato de mensagem que o agente não conseguiu tratar.

## Como verificar
1. Na tela de Logs do app gptmaker, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: gptmaker.message.receive_failed`.
3. Verifique se o erro foi pontual ou se repete com as mensagens seguintes.

## Como resolver
1. Peça ao parceiro para pedir ao contato que reenvie a mensagem.
2. Se foi momentâneo, as mensagens seguintes voltam a ser processadas.
3. Acompanhe na tela de Logs se o erro deixa de ocorrer.

## Quando escalar
Se as mensagens recebidas continuam sem ser processadas, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: gptmaker.message.receive_failed`, domínio do parceiro e o horário do evento.
