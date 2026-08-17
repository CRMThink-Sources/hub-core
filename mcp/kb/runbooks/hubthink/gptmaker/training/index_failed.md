---
category: integration
audience: suporte
summary: Falha ao indexar a base de conhecimento durante o treino.
---
# gptmaker.training.index_failed

## O que significa
O conteúdo da base foi recebido, mas houve falha ao indexá-lo (o passo que deixa o conteúdo pronto para o agente consultar). A base pode ficar desatualizada até o treino concluir.

## Causa provável
- Falha momentânea durante o processamento do treino.
- Conteúdo muito grande ou em formato problemático.

## Como verificar
1. Na tela de Logs do app gptmaker, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: gptmaker.training.index_failed`.
3. Verifique se o erro foi pontual ou se repete a cada treino.

## Como resolver
1. Peça ao parceiro para treinar a base novamente pelo painel.
2. Se o problema for um item específico, oriente a removê-lo e treinar sem ele para isolar.
3. Acompanhe na tela de Logs se o treino conclui.

## Quando escalar
Se o treino continua falhando na indexação, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: gptmaker.training.index_failed`, domínio do parceiro e o horário do evento.
