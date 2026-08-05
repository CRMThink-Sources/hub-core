---
category: validation
audience: suporte
summary: Uma coluna da planilha está ao mesmo tempo mapeada para um campo e marcada como excluída.
---
# importsheet.import.column_mapped_and_excluded

## O que significa
No de-para, cada coluna da planilha pode ser **ligada a um campo** do Bitrix24 ou
então **marcada como excluída** (quando o cliente quer que aquela coluna seja
ignorada na importação). São dois caminhos opostos: ou a coluna entra, ou fica de
fora.

Este erro quer dizer que uma mesma coluna está nos **dois estados ao mesmo tempo** —
mapeada para um campo e também marcada como excluída. Como a instrução se contradiz,
o CRMThink não sabe se deve usar ou ignorar aquela coluna, e a operação é barrada.

## Causa provável
- A coluna foi mapeada e, depois, marcada como excluída sem que o mapeamento fosse
  removido (ou o contrário).

## Como verificar
1. Na tela de Logs do app importsheet, filtre pelo `traceKey` do ticket.
2. Confirme que a linha de erro tem `código de erro: importsheet.import.column_mapped_and_excluded`.
3. Abra o de-para e localize a coluna que aparece tanto ligada a um campo quanto
   marcada como excluída.

## Como resolver
1. Oriente o parceiro a **decidir por um dos dois caminhos** para aquela coluna: ou
   a deixa mapeada para o campo, ou a mantém excluída — nunca as duas coisas.
2. Peça que ele desfaça a opção que não quer, salve e rode a importação.

## Quando escalar
Se a coluna estiver em apenas um dos estados na tela e o erro continuar, acione a
equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: importsheet.import.column_mapped_and_excluded`, domínio do parceiro, id da importação
e horário.
