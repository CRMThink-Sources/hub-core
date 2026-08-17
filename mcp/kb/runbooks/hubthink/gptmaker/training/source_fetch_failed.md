---
category: integration
audience: suporte
summary: Não foi possível baixar a fonte de treino (site ou documento) da base.
---
# gptmaker.training.source_fetch_failed

## O que significa
Ao treinar a base de conhecimento, o GPT Maker não conseguiu baixar uma fonte informada pelo parceiro (por exemplo, um site ou documento). Aquela fonte não entrou na base.

## Causa provável
- O endereço da fonte está incorreto ou fora do ar.
- A fonte exige acesso/login e não pôde ser baixada.
- Falha momentânea ao acessar a fonte.

## Como verificar
1. Na tela de Logs do app gptmaker, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: gptmaker.training.source_fetch_failed`.
3. Peça ao parceiro qual fonte estava sendo adicionada.

## Como resolver
1. Confirme com o parceiro que o endereço da fonte está correto e acessível publicamente.
2. Se a fonte exige login, oriente a adicionar o conteúdo de outra forma (texto ou arquivo).
3. Peça para tentar treinar a base novamente e acompanhe na tela de Logs.

## Quando escalar
Se a fonte é válida e pública e o download segue falhando, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: gptmaker.training.source_fetch_failed`, domínio do parceiro e o horário do evento.
