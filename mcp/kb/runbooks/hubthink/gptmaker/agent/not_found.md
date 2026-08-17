---
category: config
audience: suporte
summary: O agente de IA não foi encontrado ou está desativado.
---
# gptmaker.agent.not_found

## O que significa
O agente de IA que deveria atender a conversa não foi encontrado ou está desativado. Sem um agente ativo, não há resposta automática.

## Causa provável
- O agente foi desativado no painel.
- O agente foi removido ou nunca chegou a ser criado.
- O canal não está vinculado a nenhum agente.

## Como verificar
1. Na tela de Logs do app gptmaker, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: gptmaker.agent.not_found`.
3. Peça ao parceiro para conferir no painel se há um agente ativo vinculado ao canal.

## Como resolver
1. Oriente o parceiro a ativar (ou criar) um agente no painel.
2. Confirme que o agente está vinculado ao canal da conversa.
3. Acompanhe na tela de Logs se o agente volta a responder.

## Quando escalar
Se há um agente ativo e vinculado e o erro persiste, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: gptmaker.agent.not_found`, domínio do parceiro e o horário do evento.
