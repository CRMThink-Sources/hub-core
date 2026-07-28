---
category: integration
audience: suporte
summary: No meio da importação a planilha ou a aba ficou inacessível para a conta Google conectada.
---
# importsheet.sheet.inaccessible

## O que significa
Durante a importação, o CRMThink lê a planilha em partes, usando a conta Google que
o cliente conectou. Esse erro aparece quando, no meio da execução, a planilha (ou a
aba) deixou de ser acessível para essa conta — ou seja, a importação começou
normalmente, mas em algum momento o Google passou a recusar a leitura.

Como a leitura foi interrompida, a importação não consegue terminar. Parte das
linhas pode ter sido processada antes da interrupção, e o restante fica pendente.

## Causa provável
- **A planilha deixou de estar compartilhada** (mais comum): alguém removeu o acesso
  da conta conectada enquanto a importação rodava.
- **A planilha foi movida para a lixeira ou excluída** depois que a importação
  começou.
- **A permissão da conta conectada foi alterada ou removida** no Google no meio do
  caminho.

## Como verificar
1. Na tela de Logs do app importsheet, filtre pelo `traceKey` do ticket.
2. Confirme que a linha de erro tem `errorCode: importsheet.sheet.inaccessible`.
3. Nas Configurações da integração, veja qual é o e-mail da conta Google conectada —
   é esse acesso que precisa continuar valendo durante toda a importação.

## Como resolver
1. Oriente o parceiro a abrir o Google Sheets e confirmar que a planilha ainda
   existe e não foi enviada para a lixeira. Se estiver na lixeira, oriente a
   restaurá-la.
2. Oriente o parceiro a conferir, no botão de compartilhar da planilha, que o e-mail
   da conta Google conectada continua com acesso de leitura. Se o acesso foi
   removido, oriente a adicioná-lo de novo.
3. Com o acesso restaurado, peça para rodar a importação novamente e confirmar na
   tela de Logs que ela conclui sem o erro.

## Quando escalar
Se a planilha existe, segue compartilhada com o e-mail da conta conectada e o erro
volta a acontecer nas próximas execuções, acione a equipe de desenvolvimento. Anexe:
`traceKey`, `errorCode: importsheet.sheet.inaccessible`, domínio do parceiro, id da importação e horário.
