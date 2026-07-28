---
category: validation
audience: suporte
summary: Tentaram rodar manualmente uma importação agendada que está pausada.
---
# importsheet.run.paused

## O que significa
Uma importação agendada só roda enquanto estiver ativa. Esse erro aparece quando alguém
tenta rodar manualmente uma importação que está **pausada** — ou seja, ela existe e está
configurada, mas foi desligada e por isso não pode ser executada agora.

## Causa provável
- **Pausada de propósito**: alguém pausou a importação manualmente e ainda não a
  reativou.
- **Pausada por erro fatal**: uma rodada agendada anterior parou com um erro que
  interrompeu a execução, e o sistema pausou a importação automaticamente para não
  insistir em cima do problema.

## Como verificar
1. Na tela de Logs do app importsheet, filtre pelo `traceKey` do ticket.
2. Confirme que a linha de erro tem `errorCode: importsheet.run.paused`.
3. Na lista de importações, veja o status desta importação — ela deve aparecer como
   pausada.

## Como resolver
1. Se a importação foi pausada por causa de um erro fatal anterior, **resolva o erro
   primeiro**: veja a mensagem do último erro no modal de erros/no log e siga o
   runbook correspondente antes de reativar.
2. Oriente o parceiro a **ativar a importação** na lista de importações.
3. Com a importação ativa, peça para rodá-la de novo e confirme na tela de Logs que o
   erro não aparece mais.

## Quando escalar
Se a importação está ativa mas o sistema continua recusando a execução como pausada,
acione a equipe de desenvolvimento. Anexe: `traceKey`, `errorCode: importsheet.run.paused`, domínio do parceiro, id da
importação e horário.
