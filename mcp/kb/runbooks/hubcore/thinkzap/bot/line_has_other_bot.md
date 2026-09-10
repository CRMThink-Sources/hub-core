---
category: config
audience: suporte
summary: O canal aberto escolhido já usa um bot de saudação de outro aplicativo, e o Bitrix24 só aceita um por canal.
---
# thinkzap.bot.line_has_other_bot

## O que significa
O cliente tentou vincular um fluxo a um canal aberto que já tem um bot de saudação configurado — de outro aplicativo, não do nosso.

O Bitrix24 guarda **um único** bot de saudação por canal aberto. Vincular o fluxo ali substituiria o bot que já está lá, tirando o outro aplicativo de operação sem avisar ninguém — e não haveria como devolvê-lo depois.

**Nada mudou no portal.** O app recusou antes de mexer em qualquer configuração. O canal continua funcionando exatamente como antes, com o bot que já tinha.

Este aviso é uma proteção, não um defeito.

## Causa provável
Uma só: o canal aberto escolhido já tem bot de saudação ativo, pertencente a outro aplicativo instalado no portal.

Normalmente é um outro app de atendimento automático, ou um bot configurado direto no Bitrix24 pelo próprio cliente.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo identificador do evento (o traceKey da tela de Logs).
2. Confirme o código de erro `thinkzap.bot.line_has_other_bot`.
3. Na mesma linha do log, veja os campos: `lineName` diz qual canal, e `botDaLinha` traz o número do bot que está ocupando a linha.
4. No Bitrix24, abra **Contact Center → o canal aberto em questão → Bot de saudação**. O bot configurado ali é o que está ocupando a vaga.

## Como resolver
Há dois caminhos, e a escolha é do cliente:

1. **Vincular o fluxo a outro canal aberto** — o mais simples, quando o cliente tem mais de um canal.
2. **Liberar este canal**: nas configurações do canal aberto no Bitrix24, desativar o bot de saudação atual. Depois disso, vincular o fluxo pelo app normalmente.

Antes de orientar o segundo caminho, confirme com o cliente que o bot atual pode sair de operação — ele pertence a outro aplicativo, e desativá-lo interrompe o que aquele aplicativo fazia no canal.

Não peça para repetir o vínculo sem uma das duas ações: o resultado seria o mesmo aviso, por isso ele não é retentável.

## Quando escalar
Escale se o cliente afirma que o canal **não** tem bot de saudação configurado, ou se o número em `botDaLinha` é de um bot do próprio thinkzap (nesse caso o app deveria ter reconhecido o bot como seu). Acione a equipe de desenvolvimento e anexe: identificador do evento (traceKey), código de erro `thinkzap.bot.line_has_other_bot`, os campos `lineId`, `botDaLinha` e `nosso` da linha do log, e o domínio/portal do parceiro.
