---
category: integration
audience: suporte
summary: O canal do WhatsApp está desconectado, então o agente não envia nem recebe.
---
# gptmaker.channel.disconnected

## O que significa
O canal de conversa (WhatsApp) do parceiro está desconectado. Enquanto estiver assim, o agente não recebe mensagens novas nem consegue responder.

## Causa provável
- O aparelho que mantém a conexão ficou offline ou perdeu a sessão.
- A conexão caiu e precisa ser refeita lendo o QR Code.

## Como verificar
1. Na tela de Logs do app gptmaker, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: gptmaker.channel.disconnected`.
3. Peça ao parceiro para conferir o status do canal na tela de Conexão.

## Como resolver
1. Oriente o parceiro a abrir a tela de Conexão do canal.
2. Peça para **reconectar lendo o QR Code** com o aparelho.
3. Confirme na tela de Logs que o canal voltou a receber e responder.

## Quando escalar
Se o parceiro reconecta e o canal cai de novo repetidamente, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: gptmaker.channel.disconnected`, domínio do parceiro e o horário do evento.
