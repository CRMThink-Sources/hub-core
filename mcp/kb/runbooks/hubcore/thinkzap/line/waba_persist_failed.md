---
category: internal
audience: suporte
summary: O WhatsApp Oficial foi conectado, mas a conta (WABA) não foi gravada na linha; os templates vão recusar até ela existir.
---
# thinkzap.line.waba_persist_failed

## O que significa
O cliente conectou o número do WhatsApp Oficial (embedded signup) e o canal ficou conectado no provider. Mas a conta (WABA) não foi gravada no item da linha. É dela que as operações de template leem, então **listar, criar e enviar template vão recusar** até a WABA existir no item.

A tela mostrou sucesso, e a conexão de fato deu certo. O que falta é só o registro.

## Causa provável
- **Escrita na SPA falhou** (Bitrix24 indisponível no momento).
- **Item da linha não encontrado** pelo `channelId`.

## Como verificar
1. Filtre os Logs pelo `traceKey` e confirme `código de erro: thinkzap.line.waba_persist_failed`.
2. O log traz `channelId`, `wabaId` e, quando houver, `itemId`.
3. No item da linha (SPA 1146), confira se o `metadata` tem `wabaId`.

## Como resolver
1. Gravar o `wabaId` do log no `metadata` do item, mantendo `provider: HUBMESSAGE` e `hubmessageChannelId`.
2. Ou pedir ao cliente para refazer a conexão do canal pela tela.
3. Testar listando os templates da linha.

## Quando escalar
Se a WABA está gravada e os templates continuam recusando. Anexe: `traceKey`, domínio, `channelId` e `wabaId`.
