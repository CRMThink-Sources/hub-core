---
category: validation
audience: suporte
summary: O limite do plano do parceiro foi atingido.
---
# gptmaker.plan.limit_reached

## O que significa
O parceiro atingiu um limite do plano contratado (por exemplo, volume de atendimentos ou recurso do plano). Enquanto o limite estiver atingido, a ação fica bloqueada. **Não é bug** — é o plano.

## Causa provável
- O uso do período chegou ao limite do plano.
- O recurso solicitado não está incluído no plano atual.

## Como verificar
1. Na tela de Logs do app gptmaker, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: gptmaker.plan.limit_reached`.
3. Peça ao parceiro para conferir o plano e o uso na área de assinatura.

## Como resolver
1. Oriente o parceiro a revisar/ampliar o plano na área de assinatura.
2. Após ajustar o plano, peça para repetir a ação.
3. Confirme na tela de Logs que a ação passa a concluir.

## Quando escalar
Se o parceiro afirma estar dentro do plano e o bloqueio persiste, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: gptmaker.plan.limit_reached`, domínio do parceiro e o horário do evento.
