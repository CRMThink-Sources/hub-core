---
category: integration
audience: suporte
summary: Apagar uma mensagem já enviada pela z-api falhou.
---
# thinkzap.zapi.message_delete_failed

## O que significa
O parceiro pediu para apagar uma mensagem já enviada pelo WhatsApp não-oficial, e o app thinkzap repassou esse pedido à z-api, que recusou ou não respondeu. A mensagem não foi apagada. É uma falha na integração externa. Na prática, quase sempre a causa é a linha desconectada ou instabilidade da z-api.

## Causa provável
- **Linha desconectada**: o WhatsApp conectado por QR Code caiu, então a exclusão não é processada.
- **Mensagem não removível**: a mensagem pode estar antiga demais ou em um estado que o WhatsApp não permite apagar.
- **Instabilidade da z-api**: o serviço estava indisponível ou lento no momento.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.zapi.message_delete_failed`.
3. Leia na linha do log o status e a mensagem devolvidos pela z-api.

## Como resolver
1. Peça ao parceiro para tentar apagar a mensagem novamente em alguns instantes.
2. Verifique na aba Conexão se a linha está conectada; se não estiver, oriente a reconectar lendo o QR Code.
3. Se a mensagem não puder ser apagada (por ser antiga ou por regra do WhatsApp), explique ao parceiro que essa é uma limitação do próprio WhatsApp.

## Quando escalar
Se a exclusão continuar falhando com a linha conectada e a mensagem elegível, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.zapi.message_delete_failed`, domínio do parceiro, o horário do evento e a mensagem/status devolvidos pela z-api.
