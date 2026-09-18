---
category: validation
audience: suporte
summary: Não foi possível enviar a mensagem com botões pelo widget de conversas.
---
# thinkzap.message.widget_button_failed

## O que significa
A tentativa de enviar uma mensagem com botões (link, ligação ou resposta rápida) pelo widget de conversas não pôde ser concluída. Diferente de template, botão funciona nas duas linhas — WhatsApp Oficial e não-oficial —, mas cada uma aceita um conjunto diferente de tipos de botão. Este erro é da orquestração do envio — normalmente ligado ao número, à linha escolhida, ou aos botões preenchidos. A mensagem não seguiu.

## Causa provável
- **Tipo de botão não aceito pela linha**: a linha do WhatsApp Oficial só aceita botão de link ou ligação — sem resposta rápida.
- **Combinação de botões recusada**: na linha não-oficial, não é possível combinar um botão de resposta rápida com um de link ou ligação no mesmo envio.
- **Canal não conectado**: a linha ainda não está com o número conectado (WhatsApp Oficial) ou não está confirmadamente conectada (não-oficial).
- **Número do destinatário inválido**: o número informado está incorreto ou em formato não aceito.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.message.widget_button_failed`.
3. Leia na linha do log a linha usada, os botões preenchidos, o número de destino e a mensagem devolvida.

## Como resolver
1. Confira se os botões escolhidos são aceitos pela linha usada — WhatsApp Oficial só aceita link/ligação; a não-oficial aceita os três tipos, mas não misturados com resposta rápida.
2. Verifique se a linha está com o número conectado.
3. Confira o número do destinatário e peça para reenviar; confirme na tela de Logs que o erro não aparece mais.

## Quando escalar
Se a linha está conectada, os botões são do tipo certo para ela e o número está correto, mas o envio continua falhando, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.message.widget_button_failed`, domínio/portal do parceiro, horário do evento, e-mail da conta e os ids da linha e do destinatário.
