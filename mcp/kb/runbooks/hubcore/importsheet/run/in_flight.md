---
category: validation
audience: suporte
summary: A importação já está na fila ou em execução; não dá para iniciar outra rodada agora.
---
# importsheet.run.in_flight

## O que significa
Uma importação roda uma rodada de cada vez. Esse erro aparece quando alguém tenta
iniciar uma nova execução enquanto a importação **já está na fila ou em andamento**.
O sistema recusa a segunda tentativa de propósito, para não rodar a mesma importação
duas vezes ao mesmo tempo e acabar duplicando registros no Bitrix24.

## Causa provável
- **Rodada ainda em andamento**: a execução anterior (manual ou agendada) ainda não
  terminou — a importação lê a planilha em partes e pode levar um tempo em planilhas
  grandes.
- **Clique repetido**: o botão de rodar foi acionado mais de uma vez seguido.

## Como verificar
1. Na tela de Logs do app importsheet, filtre pelo `traceKey` do ticket.
2. Confirme que a linha de erro tem `código de erro: importsheet.run.in_flight`.
3. Na lista de importações, veja o status desta importação — ela deve aparecer como
   na fila ou em execução.

## Como resolver
1. Oriente o parceiro a **aguardar a rodada atual terminar**. Não é preciso clicar de
   novo — a execução em andamento segue sozinha até o fim.
2. Oriente a acompanhar o andamento pela lista/status da importação; quando o status
   voltar a indicar que ela terminou, é possível iniciar uma nova rodada se precisar.

## Quando escalar
Se a importação fica travada como "na fila" ou "em execução" por muito tempo e nunca
conclui, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: importsheet.run.in_flight`, domínio do parceiro,
id da importação e horário.
