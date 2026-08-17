---
category: validation
audience: suporte
summary: A base de conhecimento está vazia, então o agente responde sem contexto.
---
# gptmaker.training.empty_base

## O que significa
A base de conhecimento do agente está vazia. Sem conteúdo de treino, o agente não tem contexto para responder com qualidade — pode não responder ou responder de forma genérica.

## Causa provável
- O parceiro ainda não adicionou conteúdo à base.
- Todo o conteúdo de treino foi removido.

## Como verificar
1. Na tela de Logs do app gptmaker, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: gptmaker.training.empty_base`.
3. Peça ao parceiro para conferir no painel de treino se há conteúdo na base.

## Como resolver
1. Oriente o parceiro a adicionar conteúdo de treino (documentos, textos ou perguntas e respostas) no painel.
2. Peça para salvar e aguardar a base ser treinada.
3. Acompanhe na tela de Logs se o agente passa a responder com contexto.

## Quando escalar
Se o parceiro adicionou conteúdo e o agente segue sem contexto, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: gptmaker.training.empty_base`, domínio do parceiro e o horário do evento.
