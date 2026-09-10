---
category: integration
audience: suporte
summary: O bot não conseguiu transferir a conversa para o atendimento humano.
---
# thinkzap.bot.handoff_failed

## O que significa
O fluxo chegou ao bloco de entrega — o ponto em que o bot passa a conversa para uma pessoa — e o Bitrix24 recusou a transferência. É o pior momento para falhar: o bot já se despediu e o cliente está esperando um atendente que não foi chamado.

## Causa provável
- **Atendente indisponível**: o fluxo entrega para um atendente específico que foi desativado, removido do portal ou não é operador da linha.
- **Canal de destino inválido**: o fluxo entrega para outro canal aberto que foi apagado ou desativado.
- **Fila sem operador**: a linha não tem nenhum operador configurado para receber.
- **Instabilidade momentânea**: o Bitrix24 não respondeu na hora.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.bot.handoff_failed` e anote o `chatId` e o `targetType` (`queue`, `user` ou `line`).
3. Abra o fluxo no app (menu Bots) e veja o bloco de entrega: para quem ele aponta.
4. No Bitrix24, confirme que esse destino existe e está ativo — usuário ativo e operador da linha, ou canal aberto ativo.

## Como resolver
1. Atenda a conversa afetada manualmente: ela está aberta no Bitrix24 e não avança sozinha.
2. Corrija o destino no fluxo: abra o bloco de entrega, escolha um atendente ou canal válido (ou a fila da própria linha) e publique de novo.
3. Se o destino era a fila, confirme com o parceiro que a linha tem operadores configurados e disponíveis.
4. Como o erro é retentável, acompanhe na tela de Logs se as próximas entregas passam.

## Quando escalar
Se o destino existe, está ativo e a transferência continua falhando, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.bot.handoff_failed`, `chatId`, `targetType`, domínio/portal do parceiro, horário do evento e a mensagem devolvida pelo Bitrix24.
