---
category: validation
audience: suporte
summary: O identificador da linha bateu com mais de um registro no Bitrix24 e a linha não foi importada.
---
# importsheet.import.ambiguous_match

## O que significa
Na configuração da importação, o cliente pode escolher uma coluna da planilha para
servir de **identificador** — um valor que diz "esta linha é este registro". Isso
serve pra atualizar um registro que já existe no Bitrix24 em vez de criar um
duplicado.

Este erro quer dizer que o valor do identificador daquela linha casou com **mais
de um registro** no Bitrix24 ao mesmo tempo. Como o CRMThink não sabe qual dos
registros deveria atualizar, ele não corre o risco de mexer no registro errado: a
linha é deixada de fora e **não é importada**. Ela fica guardada como erro e pode
ser reprocessada depois que a causa for corrigida.

## Causa provável
- O valor usado como identificador (por exemplo e-mail, telefone ou documento) está
  **duplicado** no Bitrix24 — existem dois ou mais registros com o mesmo valor.
- O identificador escolhido é **pouco único** e acaba coincidindo entre registros
  diferentes.

## Como verificar
1. Na tela de Logs do app importsheet, filtre pelo `traceKey` do ticket.
2. Confirme que a linha de erro tem `código de erro: importsheet.import.ambiguous_match`.
3. Anote o valor do identificador daquela linha e procure por ele no Bitrix24:
   você deve encontrar dois ou mais registros com esse mesmo valor.

## Como resolver
1. Oriente o parceiro a abrir o Bitrix24 e localizar os registros duplicados que
   têm o mesmo valor de identificador. Isso confirma de onde vem a ambiguidade.
2. Oriente-o a **limpar os duplicados** (juntar ou remover os registros repetidos)
   ou, se preferir, a escolher na importação uma coluna de identificador que seja
   **realmente única** (um valor que só existe em um registro).
3. Depois de corrigir, oriente-o a **reprocessar** apenas as linhas que falharam,
   pela tela de erros da importação.

## Quando escalar
Se não houver registros duplicados no Bitrix24 e o erro continuar mesmo com um
identificador comprovadamente único, acione a equipe de desenvolvimento. Anexe:
`traceKey`, `código de erro: importsheet.import.ambiguous_match`, domínio do parceiro, id da importação e horário.
