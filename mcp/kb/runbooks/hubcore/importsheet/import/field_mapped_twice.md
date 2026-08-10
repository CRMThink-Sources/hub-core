---
category: validation
audience: suporte
summary: O mesmo campo do Bitrix24 está recebendo duas colunas diferentes da planilha.
---
# importsheet.import.field_mapped_twice

## O que significa
No de-para, cada campo do Bitrix24 deve receber os dados de **uma única coluna** da
planilha. É assim que o CRMThink sabe, sem dúvida, qual valor deve gravar em cada
campo.

Este erro quer dizer que **duas colunas diferentes** da planilha foram apontadas
para o **mesmo campo** do Bitrix24. Como não dá pra gravar dois valores diferentes
no mesmo campo, o CRMThink não sabe qual usar e a operação é barrada.

## Causa provável
- O cliente ligou duas colunas ao mesmo campo, provavelmente por engano ao montar o
  de-para.

## Como verificar
1. Na tela de Logs do app importsheet, filtre pelo `traceKey` do ticket.
2. Confirme que a linha de erro tem `código de erro: importsheet.import.field_mapped_twice`.
3. Abra o de-para e localize o campo do Bitrix24 que aparece ligado a mais de uma
   coluna.

## Como resolver
1. Oriente o parceiro a **deixar só uma coluna por campo**: escolher qual das colunas
   deve alimentar aquele campo e remover o mapeamento da outra.
2. Peça que ele salve e rode a importação.

## Quando escalar
Se houver apenas uma coluna por campo na tela e o erro continuar, acione a equipe de
desenvolvimento. Anexe: `traceKey`, `código de erro: importsheet.import.field_mapped_twice`, domínio do parceiro, id da importação e horário.
