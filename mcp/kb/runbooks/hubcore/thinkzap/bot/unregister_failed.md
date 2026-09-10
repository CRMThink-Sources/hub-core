---
category: integration
audience: suporte
summary: Observabilidade — o bot de atendimento ficou registrado no Bitrix24 depois de o último fluxo ser removido. Nenhum atendimento é afetado.
---
# thinkzap.bot.unregister_failed

## O que significa
Quando o último fluxo (ou o último vínculo) do portal é removido, o app tenta tirar o bot de atendimento da lista de bots do Bitrix24, por limpeza. Este aviso indica que a remoção não foi concluída.

**Nada deixa de funcionar.** O fluxo já foi apagada e o canal aberto já foi desligado do bot — o atendimento voltou ao humano normalmente. O que sobra é um bot sem uso aparecendo na lista de bots do portal.

## Causa provável
- **Instabilidade momentânea**: o Bitrix24 não respondeu o pedido de remoção.
- **Bot já removido**: alguém apagou o bot pela tela do portal antes.
- **Permissões do app**: o escopo `imbot` foi revogado depois do registro.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.bot.unregister_failed`.
3. No Bitrix24, confira se o bot "ThinkZap Atendimento" ainda aparece na lista de bots do portal.

## Como resolver
1. Nenhuma ação é necessária: o próximo vínculo de fluxo reaproveita o bot existente.
2. Se o parceiro quiser a lista limpa, o bot pode ser removido pela própria tela de bots do Bitrix24.
3. Se ele for removido à mão, o próximo vínculo registra um novo automaticamente — nada precisa ser reconfigurado no app.

## Quando escalar
Normalmente não escala: é resíduo sem efeito. Escale apenas se o parceiro remover o bot pelo portal e o app não conseguir registrar um novo no vínculo seguinte — nesse caso o erro relevante é `thinkzap.bot.register_failed`, e o runbook dele é que se aplica.
