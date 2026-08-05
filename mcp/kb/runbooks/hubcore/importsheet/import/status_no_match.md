---
category: validation
audience: suporte
summary: O valor da célula não existe na lista daquele campo no Bitrix24, então o campo ficou em branco.
---
# importsheet.import.status_no_match

## O que significa
Alguns campos do Bitrix24 não aceitam qualquer texto: eles só aceitam valores que
já existem em uma **lista pré-definida** (por exemplo o campo de fase ou de
situação). O texto da planilha precisa ser exatamente igual a uma das opções dessa
lista.

Este aviso quer dizer que o valor daquela célula **não corresponde a nenhuma opção**
da lista do campo. Quando isso acontece, o CRMThink não inventa um valor: ele
**ignora aquele campo em silêncio** e segue em frente. A linha até é importada, mas
**sem esse campo preenchido**. É por isso que aparecem tickets do tipo "importou,
mas faltou preencher o campo X".

## Causa provável
- O texto da célula está **diferente** da opção da lista: acento a mais ou a menos,
  maiúscula/minúscula, ou um **espaço extra** no começo ou no fim.
- A opção que o cliente digitou **não existe** na lista daquele campo no Bitrix24.

## Como verificar
1. Na tela de Logs do app importsheet, filtre pelo `traceKey` do ticket.
2. Confirme que a linha de erro tem `código de erro: importsheet.import.status_no_match`.
3. Abra o campo em questão no Bitrix24 e liste as opções aceitas. Compare, letra por
   letra, com o texto que está na célula da planilha — repare em acentos, espaços e
   maiúsculas.

## Como resolver
1. Oriente o parceiro a **igualar o texto da planilha** à opção exata do campo no
   Bitrix24 (mesmos acentos, mesmas maiúsculas, sem espaços sobrando).
2. Se a opção realmente não existir, oriente-o a **criar a opção faltante** na
   lista daquele campo no Bitrix24.
3. Depois de acertar, oriente-o a **reprocessar** as linhas para que o campo seja
   preenchido.

## Quando escalar
Se o texto da planilha estiver idêntico a uma opção existente e o campo continuar
sem ser preenchido, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: importsheet.import.status_no_match`, domínio
do parceiro, id da importação e horário.
