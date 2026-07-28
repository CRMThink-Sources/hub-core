---
category: validation
audience: suporte
summary: O Google recusou a aba pedida na importação por ela ser inválida.
---
# importsheet.sheet.range_invalid

## O que significa
Para ler os dados, o CRMThink pede ao Google a aba que foi escolhida na configuração
da importação. Esse erro aparece quando o Google recusou esse pedido, informando que
a aba indicada é inválida — ou seja, o nome da aba salvo na configuração não
corresponde a uma aba que o Google consiga entregar.

Enquanto a aba não for reconfigurada, o CRMThink não consegue ler a planilha e a
importação não roda.

## Causa provável
- **A aba foi renomeada** depois da configuração: o nome salvo não bate mais com o
  nome atual da aba.
- **O nome da aba tem caracteres especiais** que atrapalham a leitura.
- **A aba está vazia**, sem nenhum conteúdo para ser lido.

## Como verificar
1. Na tela de Logs do app importsheet, filtre pelo `traceKey` do ticket.
2. Confirme que a linha de erro tem `errorCode: importsheet.sheet.range_invalid`.
3. Peça ao parceiro para abrir a planilha e conferir o nome exato da aba que deveria
   ser lida e se ela tem conteúdo.

## Como resolver
1. Oriente o parceiro a abrir a configuração da importação no CRMThink e reabrir a
   seleção da aba de destino.
2. Oriente a selecionar novamente a aba correta e salvar. Isso atualiza o nome que o
   CRMThink usa para pedir os dados ao Google.
3. Se o nome da aba tiver caracteres incomuns, oriente o parceiro a renomeá-la na
   planilha para um nome simples e depois reselecioná-la na configuração.
4. Peça para rodar a importação de novo e confirmar na tela de Logs que o erro não
   aparece mais.

## Quando escalar
Se a aba foi reconfigurada, tem conteúdo e nome simples, e o erro continua, acione a
equipe de desenvolvimento. Anexe: `traceKey`, `errorCode: importsheet.sheet.range_invalid`, domínio do parceiro, id da importação e
horário.
