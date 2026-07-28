---
category: internal
audience: suporte
summary: A importação parou no meio por causa de um erro que interrompeu a execução; se era agendada, foi pausada automaticamente.
---
# importsheet.run.fatal

## O que significa
Enquanto roda, a importação lê a planilha em partes e escreve no Bitrix24. Esse erro
aparece quando algo interrompeu essa execução por completo — não foi uma linha que
falhou, foi a rodada inteira que parou. Se a importação era agendada (roda sozinha),
ela é **pausada automaticamente** para não ficar tentando de novo em cima de um
problema que não se resolve sozinho.

O ponto importante é que a mensagem desse erro **varia**. Às vezes ela aponta algo que
o suporte resolve com o parceiro (por exemplo, "Planilha ou aba inacessível" ou "Aba
não encontrada"); outras vezes é uma mensagem técnica, mais interna, que não faz
sentido pro cliente. Por isso, o primeiro passo é sempre **ler a mensagem** antes de
decidir o que fazer.

## Causa provável
- **Problema de planilha, aba ou conexão Google** (mais comum): a mensagem cita a
  planilha, a aba ou o acesso — nesse caso o caminho é o mesmo dos erros de planilha/
  conexão, e o parceiro consegue resolver.
- **Erro interno / técnico**: a mensagem é genérica ou técnica, sem uma causa clara
  que o parceiro possa corrigir sozinho.

## Como verificar
1. Na tela de Logs do app importsheet, filtre pelo `traceKey` do ticket.
2. Confirme que a linha de erro tem `errorCode: importsheet.run.fatal`.
3. Abra o modal de erros da importação (ou a linha de log) e **leia a mensagem do erro
   fatal**. É ela que diz qual é o problema real desta rodada.

## Como resolver
1. Se a mensagem apontar planilha, aba ou conexão (por exemplo "Planilha ou aba
   inacessível", "Aba não encontrada", acesso negado), siga o runbook correspondente
   de planilha/conexão Google e resolva a causa junto com o parceiro (compartilhar a
   planilha, corrigir o link, selecionar a aba certa, reconectar a conta Google).
2. Depois de corrigir a causa apontada na mensagem, se a importação era agendada e foi
   pausada, oriente o parceiro a **ativar a importação de novo** antes de rodar.
3. Peça para rodar a importação novamente e confirme na tela de Logs que o erro não
   aparece mais.

## Quando escalar
Se a mensagem do erro fatal for técnica, genérica ou sem sentido para o cliente — ou
seja, não aponta planilha/aba/conexão que o parceiro possa corrigir — acione a equipe
de desenvolvimento. Anexe: `traceKey`, `errorCode: importsheet.run.fatal`, domínio do parceiro, id da importação e horário.
