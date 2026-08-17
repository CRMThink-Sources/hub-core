---
category: integration
audience: suporte
summary: Uma ferramenta externa acionada pelo agente falhou.
---
# gptmaker.tool.call_failed

## O que significa
O agente acionou uma ferramenta externa (uma ação/integração que ele pode executar durante a conversa) e a chamada falhou. A resposta que dependia dessa ferramenta pode ter ficado incompleta.

## Causa provável
- O serviço externo da ferramenta estava indisponível.
- Falha momentânea de comunicação com a ferramenta.
- A ferramenta está configurada com dados incorretos.

## Como verificar
1. Na tela de Logs do app gptmaker, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: gptmaker.tool.call_failed`.
3. Peça ao parceiro para identificar qual ferramenta o agente usa naquela conversa.

## Como resolver
1. Confirme com o parceiro que a ferramenta está configurada corretamente.
2. Peça para repetir a ação; se foi momentâneo, volta a funcionar.
3. Acompanhe na tela de Logs se o erro deixa de ocorrer.

## Quando escalar
Se a ferramenta está bem configurada e a chamada segue falhando, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: gptmaker.tool.call_failed`, domínio do parceiro e o horário do evento.
