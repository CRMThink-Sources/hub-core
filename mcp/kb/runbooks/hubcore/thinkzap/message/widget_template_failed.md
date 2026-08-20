---
category: validation
audience: suporte
summary: Não foi possível enviar o template pelo WhatsApp Oficial.
---
# thinkzap.message.widget_template_failed

## O que significa
A tentativa de enviar um template pelo WhatsApp Oficial não pôde ser concluída. Templates só valem para linhas de WhatsApp Oficial (HubMessage) e precisam estar aprovados. Este erro é da orquestração do envio do template — normalmente ligado ao número, ao tipo de linha ou ao status do template. O template não seguiu.

## Causa provável
- **Linha não é WhatsApp Oficial**: o template foi disparado para uma linha de WhatsApp comum (não-oficial), onde template não se aplica.
- **Template não aprovado**: o template ainda não está aprovado para uso no WhatsApp Oficial.
- **Número do destinatário inválido**: o número informado está incorreto ou em formato não aceito.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.message.widget_template_failed`.
3. Leia na linha do log a linha usada, o template e o número de destino, e a mensagem devolvida.

## Como resolver
1. Confirme que a linha usada é de WhatsApp Oficial (HubMessage) — template não funciona em linha de WhatsApp comum.
2. Verifique se o template está aprovado para uso.
3. Confira o número do destinatário (correto e no formato esperado) e peça para reenviar; confirme na tela de Logs que o erro não aparece mais.

## Quando escalar
Se a linha é WhatsApp Oficial, o template está aprovado, o número está correto e o envio continua falhando, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.message.widget_template_failed`, domínio/portal do parceiro, horário do evento, e-mail da conta e os ids da linha, do template e do destinatário.
