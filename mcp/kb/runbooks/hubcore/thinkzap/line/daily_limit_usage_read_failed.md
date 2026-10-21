---
category: internal
audience: suporte
summary: O uso de hoje do limite diário não pôde ser lido agora. Os ajustes da linha continuam disponíveis.
---
# thinkzap.line.daily_limit_usage_read_failed

## O que significa
Ao abrir a aba Limites de envio de uma linha Web (não oficial), a quantidade de mensagens enviadas hoje não pôde ser consultada. A aba abre normalmente e a configuração do limite continua editável, mas o card "Limite diário" aparece sem o uso do dia. Os envios da linha não são afetados por este aviso.

## Causa provável
- **Instabilidade momentânea** no serviço interno que guarda a contagem do dia.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.line.daily_limit_usage_read_failed`.
3. Veja se o erro se repete em outras linhas ou outros portais no mesmo horário.

## Como resolver
1. Peça para o parceiro recarregar a tela em alguns instantes.
2. Se o uso voltar a aparecer, nada mais é necessário.

## Quando escalar
Se o erro persistir por mais de alguns minutos ou aparecer em vários portais ao mesmo tempo, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.line.daily_limit_usage_read_failed`, domínio do parceiro, o horário do evento e o identificador da linha.
