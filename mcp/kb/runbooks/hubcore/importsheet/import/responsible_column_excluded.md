---
category: validation
audience: suporte
summary: A coluna escolhida como responsável está marcada como excluída, o que gera conflito.
---
# importsheet.import.responsible_column_excluded

## O que significa
Na configuração, o cliente pode indicar uma coluna da planilha para definir o
**responsável** de cada registro. Para isso funcionar, essa coluna precisa ser
lida durante a importação.

Este erro quer dizer que a coluna escolhida como responsável foi, ao mesmo tempo,
**marcada como excluída** — ou seja, marcada para ser ignorada. Isso é uma
contradição: a coluna é necessária para definir o responsável, mas está mandada
ignorar. Por isso a operação é barrada.

## Causa provável
- A coluna usada como responsável foi marcada como excluída sem que a escolha de
  responsável fosse ajustada.

## Como verificar
1. Na tela de Logs do app importsheet, filtre pelo `traceKey` do ticket.
2. Confirme que a linha de erro tem `código de erro: importsheet.import.responsible_column_excluded`.
3. Abra a configuração e veja que a coluna indicada como responsável está também
   marcada como excluída.

## Como resolver
1. Oriente o parceiro a **não excluir a coluna** que está sendo usada como
   responsável — a coluna precisa continuar ativa na importação.
2. Se a intenção era mesmo ignorar aquela coluna, oriente-o a escolher outra coluna
   para o responsável (ou deixar em branco, usando o responsável padrão).
3. Peça que ele salve e rode a importação.

## Quando escalar
Se a coluna do responsável não estiver marcada como excluída na tela e o erro
continuar, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: importsheet.import.responsible_column_excluded`, domínio do
parceiro, id da importação e horário.
