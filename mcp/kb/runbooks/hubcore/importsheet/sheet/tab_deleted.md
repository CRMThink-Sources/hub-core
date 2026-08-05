---
category: integration
audience: suporte
summary: A aba (guia) escolhida na configuração não existe mais na planilha.
---
# importsheet.sheet.tab_deleted

## O que significa
Uma planilha do Google pode ter várias abas (guias na parte de baixo). Ao configurar
a importação, o cliente escolheu uma aba específica para ser lida. Esse erro aparece
quando essa aba não existe mais na planilha — o CRMThink foi buscar a guia que estava
salva na configuração e não a encontrou.

Sem a aba certa, o CRMThink não sabe de onde ler os dados, e a importação não roda.

## Causa provável
- **A aba foi renomeada** depois que a importação foi configurada: para o CRMThink, a
  aba com o nome antigo simplesmente sumiu.
- **A aba foi excluída** da planilha depois da configuração.

## Como verificar
1. Na tela de Logs do app importsheet, filtre pelo `traceKey` do ticket.
2. Confirme que a linha de erro tem `código de erro: importsheet.sheet.tab_deleted`.
3. Peça ao parceiro para abrir a planilha e comparar as abas existentes com a que foi
   escolhida na configuração da importação.

## Como resolver
1. Oriente o parceiro a abrir a configuração da importação no CRMThink e reabrir a
   seleção de aba. A lista mostra as abas que existem hoje na planilha.
2. Oriente a selecionar a aba correta (a que contém os dados a importar) e salvar a
   configuração.
3. Peça para rodar a importação de novo e confirmar na tela de Logs que o erro não
   aparece mais.

## Quando escalar
Se a aba correta está selecionada e salva, mas o erro continua, acione a equipe de
desenvolvimento. Anexe: `traceKey`, `código de erro: importsheet.sheet.tab_deleted`, domínio do parceiro, id da importação e horário.
