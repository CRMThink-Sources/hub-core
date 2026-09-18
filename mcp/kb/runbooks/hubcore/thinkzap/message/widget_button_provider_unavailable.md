---
category: integration
audience: suporte
summary: O provider de WhatsApp está temporariamente indisponível; nenhuma mensagem com botões foi enviada.
---
# thinkzap.message.widget_button_provider_unavailable

## O que significa
O app thinkzap tentou enviar uma mensagem com botões pelo widget de conversas, mas o provider (WhatsApp Oficial ou não-oficial) não respondeu ou devolveu uma falha temporária. Nenhuma mensagem foi enviada. É uma condição passageira e o envio pode ser retentado — na maioria das vezes volta a funcionar sozinho em poucos minutos.

## Causa provável
- **Indisponibilidade momentânea**: o provider estava fora do ar ou instável no momento.
- **Lentidão/timeout**: o provider demorou além do limite para responder.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.message.widget_button_provider_unavailable`.
3. Na linha do log, observe o status devolvido pelo provider — costuma indicar erro temporário/indisponibilidade.

## Como resolver
1. Aguarde alguns minutos e peça para repetir o envio.
2. Confirme na tela de Logs que o erro deixou de aparecer.
3. Se ocorrer de forma isolada e depois normalizar, nenhuma outra ação é necessária.

## Quando escalar
Se a indisponibilidade persistir por um período prolongado ou afetar vários parceiros ao mesmo tempo, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.message.widget_button_provider_unavailable`, domínio do parceiro, o horário do evento e o status devolvido pelo provider.
