---
category: internal
audience: dev
stub: true
summary: Falha interna não prevista no GPT Maker — escalar com o traceKey.
---
# gptmaker.internal.unexpected

## O que significa
Erro interno não previsto no processamento do GPT Maker. Não há ação de configuração do parceiro que resolva — é caso de escalar para o desenvolvimento.

## Como verificar
1. Na tela de Logs do app gptmaker, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: gptmaker.internal.unexpected`.

## Quando escalar
Escale sempre para a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: gptmaker.internal.unexpected`, domínio do parceiro e o horário do evento.
