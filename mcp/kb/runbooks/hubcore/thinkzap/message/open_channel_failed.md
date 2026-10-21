---
category: integration
audience: suporte
summary: A mensagem foi entregue ao contato, mas a conversa não abriu no canal aberto do Bitrix24.
---
# thinkzap.message.open_channel_failed

## O que significa
A mensagem enviada pelo widget do CRM **chegou ao contato no WhatsApp**, mas a conversa correspondente não foi criada no canal aberto do Bitrix24 do parceiro. O operador vê "Mensagem enviada com sucesso" na tela e, ao abrir o canal aberto, não encontra a conversa.

Este erro **nunca** significa que a mensagem deixou de ser entregue. O envio ao contato acontece antes, e é justamente por isso que a falha aqui não vira erro na tela: se virasse, o operador reenviaria e o contato receberia duas vezes.

## Causa provável
- **Conector não ativado naquela linha do canal aberto**: o vínculo existe no cadastro da linha, mas o conector não está ativo no canal no Bitrix24.
- **Canal aberto removido ou renumerado no Bitrix24**: o canal que a linha aponta não existe mais no portal.
- **Bitrix24 indisponível ou lento** no instante do envio (timeout, 5xx).
- **Permissões do app insuficientes** no portal para o método de canal aberto.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.message.open_channel_failed` e leia os campos `vinculatedChannel` (o canal que a linha aponta), `widgetOpenChannelEnabled` e `subscriptionItemId`.
3. Na aba Configurações da linha, confirme que o canal aberto está vinculado e que o toggle **Enviar para canal aberto** está ligado. Toggle desligado não gera este erro — gera apenas registro de `openChannelOutcome: toggle-off`, e nesse caso o comportamento está correto.
4. No Bitrix24 do parceiro, em Contact Center → Canal aberto, confirme que o canal com aquele número/id existe e que o conector do thinkzap aparece ativo nele.

## Como resolver
1. Se o canal aberto foi removido ou trocado: revincular a linha ao canal correto na aba Configurações. O vínculo reativa o conector no Bitrix24.
2. Se o canal existe mas o conector não está ativo: desvincular e vincular de novo pela aba Configurações — a ativação acontece nesse passo.
3. Se foi indisponibilidade momentânea do Bitrix24: **não há ação necessária**. A conversa é reparada automaticamente na confirmação de entrega da linha, e o próximo envio para o mesmo contato tenta de novo.
4. Peça ao parceiro para enviar uma nova mensagem pelo widget e confirme na tela de Logs que o registro passou a sair com `openChannelOutcome: opened`.

## Quando escalar
Se o canal está vinculado, o toggle está ligado, o conector aparece ativo no Bitrix24 e a conversa continua não abrindo em envios repetidos, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.message.open_channel_failed`, domínio/portal do parceiro, horário do evento, `subscriptionItemId`, o `vinculatedChannel` do log e o telefone de destino.
