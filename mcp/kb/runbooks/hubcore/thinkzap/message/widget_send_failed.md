---
category: validation
audience: suporte
summary: Não foi possível enviar a mensagem.
---
# thinkzap.message.widget_send_failed

## O que significa
A tentativa de enviar uma mensagem pelo app thinkzap não pôde ser concluída. Este erro é da etapa de orquestração do envio — normalmente ligado ao número do destinatário ou ao estado da linha (ativa e conectada). A mensagem não seguiu.

## Causa provável
- **Número do destinatário inválido**: o número informado está incorreto ou em formato não aceito.
- **Linha inativa ou desconectada**: a linha usada não está ativa ou não está conectada ao WhatsApp.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.message.widget_send_failed`.
3. Leia na linha do log o número de destino e a linha usada, e a mensagem devolvida.

## Como resolver
1. Confira com o parceiro se o número do destinatário está correto e no formato esperado.
2. Verifique na aba Conexão se a linha está ativa e conectada; se não estiver, oriente a reconectar (ler o QR Code).
3. Peça para reenviar a mensagem e confirme na tela de Logs que o erro não aparece mais.

## Quando escalar
Se o número está correto, a linha está ativa e conectada e o envio continua falhando, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.message.widget_send_failed`, domínio/portal do parceiro, horário do evento, e-mail da conta e os ids da linha e do destinatário.
