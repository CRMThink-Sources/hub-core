---
category: integration
audience: suporte
summary: O Bitrix24 não guardou o bot no canal aberto; o fluxo não foi vinculada.
---
# thinkzap.bot.line_bind_failed

## O que significa
Para um fluxo atender num canal aberto, o app grava o bot de atendimento como "bot de boas-vindas" daquele canal, e em seguida **lê de volta** para confirmar. Este erro indica que o Bitrix24 aceitou o pedido mas o bot não ficou gravado no canal.

O vínculo **não** foi criado do nosso lado — a tela não mostra o fluxo como ativo. Isso é proposital: sem a confirmação, o fluxo apareceria ativo e nenhuma mensagem entraria na linha, o que é pior que a recusa.

## Causa provável
- **Outro app usa o mesmo campo**: o canal aberto tem um único bot de boas-vindas, e outro aplicativo pode estar gravando o seu por cima do nosso.
- **Canal aberto inativo ou apagado** entre a escolha na tela e a gravação.
- **Configuração do canal bloqueada** por permissão do usuário que fez a operação.
- **Instabilidade momentânea**: o Bitrix24 respondeu ok sem persistir.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.bot.line_bind_failed` e anote `lineId`, `esperado` e `encontrado`.
3. `encontrado` com outro número = há outro bot configurado no canal (provavelmente de outro app). `encontrado: null` = o campo ficou vazio.
4. No Bitrix24, abra **Contact Center → o canal aberto → Bot de boas-vindas** e veja o que está configurado ali.

## Como resolver
1. Se outro app configurou um bot nesse canal: o parceiro precisa decidir qual dos dois atende o canal — apenas um é possível. Se a escolha for o ThinkZap, remova o bot do outro app e vincule de novo.
2. Se o canal estava inativo, reative-o (ou escolha outro canal) e tente novamente.
3. Confirme que o usuário que fez a operação pode alterar as configurações do canal aberto.
4. Como o erro é retentável, peça para repetir o vínculo e confirme na tela de Logs.

## Quando escalar
Se o canal está ativo, sem bot de outro app, o usuário tem permissão e a gravação continua não persistindo, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.bot.line_bind_failed`, `lineId`, os valores `esperado`/`encontrado` do log, domínio/portal do parceiro e horário do evento.
