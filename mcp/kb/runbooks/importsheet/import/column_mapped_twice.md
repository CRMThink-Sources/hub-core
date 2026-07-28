---
category: validation
audience: suporte
summary: A mesma coluna da planilha foi mapeada duas vezes no de-para.
---
# importsheet.import.column_mapped_twice

## O que significa
No de-para, cada coluna da planilha deve aparecer **uma única vez** — ligada ao
campo do Bitrix24 que vai receber os dados dela. Uma coluna não deve ser mapeada
mais de uma vez.

Este erro quer dizer que a **mesma coluna** da planilha foi mapeada **duas vezes** no
de-para. Essa repetição deixa a configuração ambígua, e por isso a operação é
barrada até que a duplicidade seja removida.

## Causa provável
- O cliente adicionou a mesma coluna ao de-para mais de uma vez, geralmente por
  engano ao montar a configuração.

## Como verificar
1. Na tela de Logs do app importsheet, filtre pelo `traceKey` do ticket.
2. Confirme que a linha de erro tem `errorCode: importsheet.import.column_mapped_twice`.
3. Abra o de-para e localize a coluna da planilha que aparece repetida.

## Como resolver
1. Oriente o parceiro a **remover o mapeamento duplicado**, deixando a coluna
   presente apenas uma vez no de-para.
2. Peça que ele salve e rode a importação.

## Quando escalar
Se a coluna aparecer só uma vez na tela e o erro continuar, acione a equipe de
desenvolvimento. Anexe: `traceKey`, `errorCode: importsheet.import.column_mapped_twice`, domínio do parceiro, id da importação e horário.
