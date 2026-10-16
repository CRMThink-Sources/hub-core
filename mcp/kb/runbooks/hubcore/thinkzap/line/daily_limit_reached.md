---
category: validation
audience: suporte
summary: Esta linha atingiu o limite diário de mensagens configurado. A mensagem não foi enviada.
---
# thinkzap.line.daily_limit_reached

## O que significa
A linha Web (não oficial) tem um limite diário de mensagens ativado, e a quantidade enviada hoje já chegou a esse limite. Para proteger a linha contra bloqueio por excesso de envio, novas mensagens são recusadas até a virada do dia (meia-noite no horário de Brasília). Não é falha técnica: é o limite configurado pelo próprio cliente funcionando. A mensagem recusada não foi entregue ao contato e não conta no limite.

## Causa provável
- **Volume do dia chegou ao limite**: respostas de operador, widget (inclusive envio com anexo), robôs (inclusive "Enviar mensagem"), Campanha de SMS e bot somam no mesmo limite. No robô "Enviar mensagem", os destinatários recusados aparecem listados no comentário da timeline.
- **Limite baixado durante o dia**: se o limite foi reduzido para um valor menor ou igual ao que já foi enviado hoje, os próximos envios são recusados na hora.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.line.daily_limit_reached`.
3. Na configuração da linha, aba Ajustes, card "Limite diário": confira enviadas hoje, limite efetivo e a indicação de limite atingido.

## Como resolver
1. Explique ao parceiro que o envio foi recusado pelo limite diário que ele configurou.
2. Se ele precisar enviar mais hoje, oriente a usar "Liberar limite temporário" no card "Limite diário": as mensagens extras valem só para hoje.
3. Se o volume for frequente, oriente a revisar o limite configurado, lembrando que limite alto aumenta o risco de bloqueio da linha.
4. Mensagens recusadas não são reenviadas sozinhas: depois de liberar, peça para repetir o envio.

## Quando escalar
Se o card mostrar que o limite não foi atingido (ou estiver desativado) e o erro continuar aparecendo, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.line.daily_limit_reached`, domínio do parceiro, o horário do evento, o identificador da linha e um print do card "Limite diário".
