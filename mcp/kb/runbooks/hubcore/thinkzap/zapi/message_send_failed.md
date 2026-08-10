---
category: integration
audience: suporte
summary: A z-api não conseguiu enviar a mensagem ao contato pelo WhatsApp.
---
# thinkzap.zapi.message_send_failed

## O que significa
O app thinkzap entregou a mensagem à z-api para envio pelo WhatsApp não-oficial (linha conectada por QR Code), mas a z-api recusou ou não respondeu, e a mensagem não chegou ao contato. É uma falha na integração externa. Na prática, quase sempre a causa é a linha desconectada ou instabilidade da z-api.

## Causa provável
- **Linha desconectada**: o WhatsApp conectado por QR Code caiu, então nada é enviado.
- **Número inválido**: o número do contato está errado ou não existe no WhatsApp.
- **Instabilidade da z-api**: o serviço estava indisponível ou lento no momento.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.zapi.message_send_failed`.
3. Leia na linha do log o status e a mensagem devolvidos pela z-api — costuma indicar se foi número inválido, linha desconectada ou instabilidade.

## Como resolver
1. Verifique na aba Conexão se a linha está conectada (WhatsApp conectado por QR Code); se não estiver, oriente a reconectar lendo o QR Code.
2. Confira o número do contato: deve ser um WhatsApp válido, com DDI/DDD corretos.
3. Com a linha conectada e o número correto, peça para reenviar em alguns instantes e confirme na tela de Logs que o erro não aparece mais.

## Quando escalar
Se o envio continuar falhando com a linha conectada e o número válido, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.zapi.message_send_failed`, domínio do parceiro, o horário do evento, o número do contato e a mensagem/status devolvidos pela z-api.
