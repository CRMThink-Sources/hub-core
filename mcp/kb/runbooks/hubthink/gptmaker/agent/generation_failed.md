---
category: integration
audience: suporte
summary: O agente não conseguiu gerar a resposta (falha no modelo de IA).
---
# gptmaker.agent.generation_failed

## O que significa
O agente recebeu a mensagem, mas não conseguiu gerar a resposta de IA. A conversa fica sem resposta automática nessa rodada. Costuma ser uma falha momentânea.

## Causa provável
- Instabilidade momentânea do serviço de IA.
- A resposta demorou demais e foi interrompida.

## Como verificar
1. Na tela de Logs do app gptmaker, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: gptmaker.agent.generation_failed`.
3. Verifique se o erro foi pontual ou se repete nas mensagens seguintes.

## Como resolver
1. Peça ao parceiro para enviar a mensagem novamente na conversa.
2. Se foi momentâneo, o agente volta a responder na sequência.
3. Antes de escalar, confirme que não é **falta de créditos** (`gptmaker.credits.insufficient`) nem **base vazia** (`gptmaker.training.empty_base`).

## Quando escalar
Se o agente segue sem gerar resposta em várias tentativas e não é falta de créditos nem base vazia, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: gptmaker.agent.generation_failed`, domínio do parceiro e o horário do evento.
