---
category: integration
audience: suporte
summary: O Bitrix24 não desligou o bot do canal aberto; o vínculo do fluxo foi mantido para o canal não ficar com um bot sem fluxo.
---
# thinkzap.bot.line_unbind_failed

## O que significa
Ao remover o vínculo entre um fluxo e um canal aberto (ou ao excluir o fluxo), o app desliga o bot de boas-vindas daquele canal e **lê de volta** para confirmar. Este erro indica que o Bitrix24 aceitou o pedido mas o bot continua ligado no canal.

**O vínculo foi mantido de propósito.** Se ele fosse apagado com o bot ainda ativo na linha, o cliente escreveria, o Bitrix entregaria a mensagem ao bot, e não haveria fluxo para responder — o cliente ficaria esperando uma resposta que nunca vem. Manter o vínculo preserva o atendimento até o problema ser resolvido.

## Causa provável
- **Outro app regravou o campo**: o canal aberto tem um único bot de boas-vindas, e outro aplicativo pode ter escrito o seu depois de nós.
- **Configuração do canal bloqueada** por permissão do usuário que fez a operação.
- **Instabilidade momentânea**: o Bitrix24 respondeu ok sem aplicar a mudança.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.bot.line_unbind_failed` e anote `lineId` e `botId`.
3. `botId` diferente do bot do ThinkZap indica que outro app assumiu o campo.
4. No Bitrix24, abra **Contact Center → o canal aberto → Bot de boas-vindas** e veja o estado atual.

## Como resolver
1. Tente remover o vínculo novamente pela tela do app — na maioria dos casos foi instabilidade e a segunda tentativa passa.
2. Se o `botId` do log for de outro app: o campo já não é nosso. O parceiro pode remover o vínculo pelo app (a operação vai passar quando o campo estiver livre) ou desligar o bot manualmente na tela do canal.
3. Confirme que o usuário que fez a operação pode alterar as configurações do canal aberto.
4. Enquanto o vínculo existe, o fluxo continua atendendo normalmente — não há urgência.

## Quando escalar
Se o canal está acessível, o usuário tem permissão, nenhum outro app disputa o campo e o desligamento continua não persistindo, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.bot.line_unbind_failed`, `lineId`, `botId` do log, domínio/portal do parceiro e horário do evento.
