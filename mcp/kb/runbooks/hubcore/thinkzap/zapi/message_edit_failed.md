---
category: integration
audience: suporte
summary: Editar uma mensagem já enviada pela z-api falhou.
---
# thinkzap.zapi.message_edit_failed

## O que significa
O parceiro pediu para editar uma mensagem já enviada pelo WhatsApp não-oficial, e o app thinkzap repassou esse pedido à z-api, que recusou ou não respondeu. A edição não foi aplicada. É uma falha na integração externa. Na prática, quase sempre a causa é a linha desconectada ou instabilidade da z-api.

## Causa provável
- **Linha desconectada**: o WhatsApp conectado por QR Code caiu, então a edição não é processada.
- **Mensagem não editável**: a mensagem pode estar antiga demais ou em um estado que o WhatsApp não permite editar.
- **Instabilidade da z-api**: o serviço estava indisponível ou lento no momento.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.zapi.message_edit_failed`.
3. Leia na linha do log o status e a mensagem devolvidos pela z-api.

## Como resolver
1. Peça ao parceiro para tentar a edição novamente em alguns instantes.
2. Verifique na aba Conexão se a linha está conectada; se não estiver, oriente a reconectar lendo o QR Code.
3. Se a mensagem não puder ser editada (por ser antiga ou por regra do WhatsApp), oriente o parceiro a enviar uma nova mensagem no lugar.

## Quando escalar
Se a edição continuar falhando com a linha conectada e a mensagem elegível, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.zapi.message_edit_failed`, domínio do parceiro, o horário do evento e a mensagem/status devolvidos pela z-api.
