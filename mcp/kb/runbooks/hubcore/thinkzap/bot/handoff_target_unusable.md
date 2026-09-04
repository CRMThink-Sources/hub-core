---
category: config
audience: suporte
summary: O bloco de entrega do fluxo aponta para um atendente ou canal que não existe mais; a conversa foi para a fila da linha.
---
# thinkzap.bot.handoff_target_unusable

## O que significa
O fluxo chegou ao bloco de entrega e o destino gravado estava vazio ou inutilizável. **A conversa não foi perdida**: o bot entregou para a fila da própria linha, e um operador disponível recebe normalmente. O aviso existe porque o fluxo não fez o que o parceiro configurou — se ele escolheu um atendente específico, a conversa foi para outro lugar.

Isto não é falha de integração: é configuração desatualizada. A publicação do fluxo recusa destino vazio, mas a conversa em andamento roda com uma cópia do fluxo tirada no início dela, e o atendente pode ter saído do portal depois disso.

## Causa provável
- **Atendente saiu do portal** depois de o fluxo ter sido publicada.
- **Canal aberto apagado** depois de o fluxo ter sido publicada.
- **Fluxo antiga**: publicada antes de o destino ser exigido, e o bloco ficou sem escolha.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.bot.handoff_target_unusable` e anote o `targetType` (`user` ou `line`).
3. Abra o fluxo no app (menu Bots) e localize o bloco de entrega: ele mostra o problema marcado no próprio bloco.

## Como resolver
1. Abra o bloco de entrega do fluxo, escolha de novo o atendente ou o canal e publique.
2. Se a intenção era realmente a fila da linha, troque o bloco para "Fila do canal aberto" — assim o aviso deixa de aparecer e o fluxo passa a descrever o que acontece de fato.
3. Confirme na tela de Logs que o aviso não volta nas conversas seguintes.

## Quando escalar
Normalmente não escala: é ajuste de configuração no fluxo. Se o bloco de entrega já aponta um destino válido, o fluxo foi publicado e o aviso continua aparecendo, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.bot.handoff_target_unusable`, `targetType`, nome do fluxo, domínio/portal do parceiro e horário do evento.
