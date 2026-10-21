---
category: validation
audience: suporte
summary: O limite temporário só pode ser liberado com o limite diário ativado e salvo.
---
# thinkzap.line.daily_limit_disabled

## O que significa
O parceiro tentou liberar mensagens extras para hoje, mas a linha não está com o limite diário ativado e salvo. Sem limite ativo não há o que ampliar, então nada foi gravado. Não é falha técnica.

## Causa provável
- **Limite desativado**: o limite diário da linha está desligado.
- **Limite ativado mas não salvo**: o parceiro ligou o limite na tela, mas ainda não clicou em "Salvar alterações".

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.line.daily_limit_disabled`.
3. Na aba Limites de envio da linha, confira se o card "Limite diário" está ativado e se há alterações pendentes na barra de salvamento.

## Como resolver
1. Oriente a ativar o limite diário, informar o valor e clicar em "Salvar alterações".
2. Depois de salvo, a ação "Liberar limite temporário" fica disponível.

## Quando escalar
Se o limite aparecer ativado e salvo e o erro continuar, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.line.daily_limit_disabled`, domínio do parceiro, o horário do evento e o identificador da linha.
