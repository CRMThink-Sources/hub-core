---
category: validation
audience: suporte
summary: Tentaram reprocessar linhas enquanto a importação ainda estava em execução.
---
# importsheet.reprocess.in_flight

## O que significa
Quando uma importação roda, o CRMThink lê a planilha em páginas e vai escrevendo
os registros no Bitrix24. As linhas que dão erro ficam guardadas pra serem
**reprocessadas** depois — ou seja, rodadas de novo só elas, sem repetir a
planilha inteira.

Esse erro quer dizer que alguém pediu pra reprocessar as linhas com erro enquanto
a importação **ainda estava rodando**. Como já existe uma execução em andamento, o
CRMThink não inicia o reprocessamento em cima dela — o pedido é recusado e nada é
alterado.

## Causa provável
- **Reprocessar cedo demais** (mais comum): o parceiro abriu o modal de erros e
  clicou pra reprocessar antes da execução atual terminar.
- **Execução agendada em curso**: a importação estava rodando sozinha (agendada)
  no momento em que o parceiro tentou reprocessar manualmente.

## Como verificar
1. Na tela de Logs do app importsheet, filtre pelo `traceKey` do ticket.
2. Confirme que a linha de erro tem `errorCode: importsheet.reprocess.in_flight`
   — assim você tem certeza que é este caso, e não outro erro de reprocessamento.
3. Veja o horário da linha e o domínio pra identificar o parceiro e cruzar com a
   execução que estava rodando naquele momento.

## Como resolver
1. Oriente o parceiro a **aguardar a execução atual terminar**. Enquanto a
   importação estiver rodando, o reprocessamento não pode começar.
2. Quando a execução acabar, peça que ele abra a importação, veja as linhas com
   erro no **modal de erros** e clique pra reprocessar. Aí o pedido é aceito.
3. Confirme com o parceiro que as linhas antes com erro foram gravadas no Bitrix24.

## Quando escalar
Se não havia nenhuma execução em andamento e o erro continua aparecendo ao tentar
reprocessar, o problema não é de momento — acione a equipe de desenvolvimento.
Anexe: `traceKey`, `errorCode: importsheet.reprocess.in_flight`, domínio do parceiro, id da importação e horário.
