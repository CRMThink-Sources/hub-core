---
category: validation
audience: suporte
summary: A linha de cabeçalho indicada na planilha está vazia, então não há colunas para mapear.
---
# importsheet.sheet.header_empty

## O que significa
Na configuração da importação, o cliente indica em qual linha da planilha estão os
títulos das colunas — é o **cabeçalho**. O CRMThink usa esses títulos para montar o
de-para, ou seja, para saber qual coluna da planilha vai para qual campo do Bitrix24.

Esse erro aparece quando a linha apontada como cabeçalho está vazia. Sem títulos, o
CRMThink não encontra nenhuma coluna para mapear e a importação não avança.

## Causa provável
- **A "linha de início" do cabeçalho aponta para a linha errada** (mais comum): por
  exemplo, aponta para uma linha em branco acima ou abaixo dos títulos reais.
- **A aba escolhida está errada**: a aba selecionada não é a que tem os títulos.
- **O cabeçalho foi apagado** da planilha depois de configurar.

## Como verificar
1. Na tela de Logs do app importsheet, filtre pelo `traceKey` do ticket.
2. Confirme que a linha de erro tem `código de erro: importsheet.sheet.header_empty`.
3. Peça ao parceiro para abrir a planilha e olhar em qual linha estão os títulos das
   colunas (por exemplo, linha 1) e comparar com a "linha de início" salva na
   configuração.

## Como resolver
1. Oriente o parceiro a conferir se a aba selecionada na importação é realmente a que
   contém os títulos das colunas.
2. Oriente a abrir a configuração da importação e ajustar a "linha de início" do
   cabeçalho para apontar exatamente para a linha onde estão os títulos.
3. Se o cabeçalho tiver sido apagado, oriente o parceiro a recolocar a linha de
   títulos na planilha.
4. Peça para salvar, rodar a importação de novo e confirmar na tela de Logs que o
   erro não aparece mais.

## Quando escalar
Se a aba e a linha de início estão corretas, os títulos existem na planilha e o erro
continua, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: importsheet.sheet.header_empty`, domínio do parceiro,
id da importação e horário.
