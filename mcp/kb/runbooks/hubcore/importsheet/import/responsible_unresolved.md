---
category: validation
audience: suporte
summary: Não foi possível identificar o responsável indicado na linha, então a importação usou o responsável padrão.
---
# importsheet.import.responsible_unresolved

## O que significa
Na configuração da importação, o cliente pode escolher uma coluna da planilha para
definir o **responsável** de cada registro — o usuário do Bitrix24 que vai ficar
como dono daquele lead, negócio ou contato.

Este aviso quer dizer que o CRMThink **não conseguiu identificar** qual usuário do
Bitrix24 corresponde ao valor daquela linha. Para não deixar o registro sem dono, a
importação seguiu em frente usando o **responsável padrão**. Ou seja: a linha foi
importada, mas o responsável não é o que estava indicado na planilha.

## Causa provável
- O valor da coluna de responsável (nome, e-mail ou ID) **não corresponde a nenhum
  usuário** do Bitrix24.
- O usuário existe, mas está **inativo/desligado** no Bitrix24 e por isso não pode
  receber registros.
- Pequenas diferenças de escrita no nome ou no e-mail que impedem o encaixe.

## Como verificar
1. Na tela de Logs do app importsheet, filtre pelo `traceKey` do ticket.
2. Confirme que a linha de erro tem `código de erro: importsheet.import.responsible_unresolved`.
3. Anote o valor da coluna de responsável daquela linha e procure por esse usuário
   no Bitrix24 — verifique se ele existe e se está **ativo**.

## Como resolver
1. Oriente o parceiro a usar, na coluna de responsável, o **ID ou o e-mail exato**
   de um usuário **ativo** do Bitrix24. O ID e o e-mail são as formas mais seguras
   de identificar o usuário sem ambiguidade.
2. Se o usuário estava inativo, oriente-o a reativá-lo no Bitrix24 ou a indicar
   outro usuário ativo.
3. Se quiser corrigir os registros que já foram criados com o responsável padrão,
   oriente-o a **reprocessar** as linhas afetadas.

## Quando escalar
Se o valor da coluna corresponder a um usuário ativo e comprovadamente existente e o
responsável ainda assim não for aplicado, acione a equipe de desenvolvimento.
Anexe: `traceKey`, `código de erro: importsheet.import.responsible_unresolved`, domínio do parceiro, id da importação e horário.
