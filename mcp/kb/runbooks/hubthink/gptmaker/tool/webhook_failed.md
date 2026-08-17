---
category: integration
audience: suporte
summary: Um webhook de integração do GPT Maker falhou.
---
# gptmaker.tool.webhook_failed

## O que significa
O GPT Maker tentou notificar um webhook de integração do parceiro (um endereço que recebe eventos da conversa) e a entrega falhou. A integração que depende desse webhook pode não ter recebido o evento.

## Causa provável
- O endereço do webhook do parceiro estava fora do ar ou instável.
- O endereço configurado está incorreto.
- Falha momentânea de comunicação na entrega.

## Como verificar
1. Na tela de Logs do app gptmaker, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: gptmaker.tool.webhook_failed`.
3. Peça ao parceiro para conferir o endereço do webhook configurado.

## Como resolver
1. Confirme com o parceiro que o endereço do webhook está correto e no ar.
2. Peça para repetir a ação; se foi momentâneo, a entrega volta a funcionar.
3. Acompanhe na tela de Logs se o erro deixa de ocorrer.

## Quando escalar
Se o endereço está correto e no ar e a entrega segue falhando, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: gptmaker.tool.webhook_failed`, domínio do parceiro e o horário do evento.
