---
category: config
audience: dev
summary: O identificador do bot de atendimento já está registrado por outra instalação do app no mesmo portal; vincular o fluxo falha até o ambiente usar um identificador próprio.
---
# thinkzap.bot.code_taken

## O que significa
Para um fluxo atender sozinho num canal aberto, o app registra um bot de mensageria dentro do Bitrix24. Esse bot é identificado por um código, e o código é único **no portal** — não por instalação do app.

O portal recusou o registro porque já existe um bot com esse código, criado por **outra** instalação. O registro só é reaproveitado quando quem pede é a mesma instalação que criou o bot; de outra instalação, o portal responde que o código já está tomado.

**Nada mudou no portal.** O fluxo não foi vinculado e o canal aberto continua no atendimento humano.

## Causa provável
Dois ambientes nossos apontados para o mesmo portal do Bitrix24 — tipicamente uma máquina de desenvolvimento ou o ambiente de homologação usando o portal em que produção já registrou o bot. Cada ambiente é uma instalação distinta do app, e as duas disputam o mesmo código.

O banco do ambiente que falhou não tem registro do bot (se tivesse, o app reaproveitaria o registro em vez de tentar criar outro). Por isso o erro reaparece em toda tentativa de vincular.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo identificador do evento (o traceKey da tela de Logs).
2. Confirme o código de erro `thinkzap.bot.code_taken`.
3. Na mesma linha do log, leia o campo `code` — é o identificador que o portal recusou.
4. Confirme qual ambiente atendeu a requisição e se o portal em questão também é usado por outro ambiente.

## Como resolver
1. No ambiente que falhou, defina `BITRIX_BOT_FLOW_CODE` com um valor próprio — por exemplo `thinkzap-flow-dev` ou `thinkzap-flow-homolog`.
2. Reinicie a API para o valor entrar em vigor.
3. Vincule o fluxo ao canal novamente. O registro passa a criar um bot próprio daquele ambiente, e o bot de produção segue intacto.

Produção fica no valor padrão: trocá-lo lá criaria um segundo bot nos portais que já têm o atual, deixando o antigo órfão nas conversas em curso.

Não é retentável sem essa mudança — repetir a vinculação com o mesmo identificador dá o mesmo resultado.

## Quando escalar
Escale se o identificador já é exclusivo daquele ambiente e o portal continua recusando o registro: nesse caso sobrou um bot com esse mesmo código de uma configuração anterior, e removê-lo do portal exige a instalação que o criou. Anexe: identificador do evento (traceKey), código de erro `thinkzap.bot.code_taken`, o campo `code` do log, domínio/portal, ambiente que atendeu a requisição e horário.
