---
category: integration
audience: suporte
summary: O WhatsApp Oficial está temporariamente indisponível; nenhuma mensagem foi enviada.
---
# thinkzap.template.provider_unavailable

## O que significa
O app thinkzap tentou uma operação de template no WhatsApp Oficial, mas o provedor não respondeu ou devolveu uma falha temporária (indisponibilidade momentânea). Nenhuma mensagem foi enviada. É uma condição passageira e a operação pode ser retentada — na maioria das vezes volta a funcionar sozinha em poucos minutos.

## Causa provável
- **Indisponibilidade momentânea**: o WhatsApp Oficial estava fora do ar ou instável no momento.
- **Lentidão/timeout**: o provedor demorou além do limite para responder.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.template.provider_unavailable`.
3. Na linha do log, observe o status devolvido pelo provedor — costuma indicar erro temporário/indisponibilidade.

## Como resolver
1. Aguarde alguns minutos e peça para repetir a operação.
2. Confirme na tela de Logs que o erro deixou de aparecer.
3. Se ocorrer de forma isolada e depois normalizar, nenhuma outra ação é necessária.

## Quando escalar
Se a indisponibilidade persistir por um período prolongado ou afetar vários parceiros ao mesmo tempo, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.template.provider_unavailable`, domínio do parceiro, o horário do evento e o status devolvido pelo provedor.
