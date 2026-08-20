---
category: validation
audience: suporte
summary: Este canal aberto já atende outra linha.
---
# thinkzap.line.channel_already_linked

## O que significa
O parceiro tentou vincular uma linha a um canal aberto do Bitrix que já é de outra linha da mesma instalação, e o vínculo foi recusado. Nada foi alterado: a linha continua sem canal, e a outra linha segue atendendo o canal normalmente.

Um canal aberto atende **uma** linha só. Não é limite arbitrário: quando o operador responde no CRM, o evento que o Bitrix nos envia identifica apenas o **canal**, nunca a linha. Com duas linhas no mesmo canal não há no evento nada que diga por qual número responder — a mensagem sairia por um número imprevisível, o provider aceitaria, e o contato daquele atendimento não receberia nada.

## Causa provável
- **Segunda linha apontada para o mesmo canal**: o parceiro contratou outra linha e reaproveitou o canal aberto da primeira, esperando uma fila única de atendimento.
- **Canal reaproveitado após troca de número**: a linha antiga continua vinculada ao canal, e a nova tenta usá-lo.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.line.channel_already_linked`.
3. O log traz `line` (o canal pedido) e `occupiedBySubscriptionItemId` (a linha que já o ocupa). A mensagem exibida ao parceiro já nomeia essa linha.

## Como resolver
1. Confirme com o parceiro qual das duas linhas deve atender aquele canal.
2. Se a nova linha deve ficar com o canal: desvincule o canal da linha antiga na aba Ajustes dela e repita o vínculo.
3. Se as duas linhas devem atender: oriente a criar um **canal aberto novo** no Bitrix para a segunda linha (Contact Center → Canais abertos). Cada linha com seu canal.
4. Se o parceiro quer uma fila única com dois números, explique a limitação e registre o pedido como melhoria — hoje o roteamento de saída não tem como distinguir as linhas.

## Quando escalar
Se a mensagem apontar uma linha que o parceiro afirma não existir ou já ter sido desvinculada, acione a equipe de desenvolvimento: pode ser item duplicado na SPA de itens. Anexe: `traceKey`, `código de erro: thinkzap.line.channel_already_linked`, domínio do parceiro, o canal pedido e as linhas envolvidas.
