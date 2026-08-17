---
category: integration
audience: suporte
summary: A resposta do agente não foi entregue ao contato.
---
# gptmaker.message.send_failed

## O que significa
O agente gerou a resposta, mas ela não foi entregue ao contato. A conversa fica sem a mensagem sair. Costuma ser falha momentânea de envio.

## Causa provável
- Canal desconectado no momento do envio (ver `gptmaker.channel.disconnected`).
- Falha momentânea de comunicação ao entregar a mensagem.

## Como verificar
1. Na tela de Logs do app gptmaker, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: gptmaker.message.send_failed`.
3. Confirme se o canal do parceiro está conectado na tela de Conexão.

## Como resolver
1. Verifique se o canal está conectado; se não, reconecte lendo o QR Code.
2. Peça ao parceiro para enviar a mensagem novamente na conversa.
3. Acompanhe na tela de Logs se o envio passa a concluir.

## Quando escalar
Se o canal está conectado e o envio continua falhando, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: gptmaker.message.send_failed`, domínio do parceiro e o horário do evento.
