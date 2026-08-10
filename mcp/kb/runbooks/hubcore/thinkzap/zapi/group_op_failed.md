---
category: integration
audience: suporte
summary: Uma operação de grupo de WhatsApp na z-api falhou.
---
# thinkzap.zapi.group_op_failed

## O que significa
O parceiro executou uma operação sobre um grupo de WhatsApp (por exemplo, criar o grupo, adicionar ou remover participantes) pelo WhatsApp não-oficial, e o app thinkzap repassou o pedido à z-api, que recusou ou não respondeu. A operação de grupo não foi concluída. É uma falha na integração externa. Na prática, quase sempre a causa é a linha desconectada ou instabilidade da z-api.

## Causa provável
- **Linha desconectada**: o WhatsApp conectado por QR Code caiu, então a operação de grupo não é processada.
- **Restrição do grupo/participante**: número inválido, participante que não pode ser adicionado, ou permissão insuficiente da linha no grupo.
- **Instabilidade da z-api**: o serviço estava indisponível ou lento no momento.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.zapi.group_op_failed`.
3. Leia na linha do log qual foi a operação de grupo e o status/mensagem devolvidos pela z-api.

## Como resolver
1. Verifique na aba Conexão se a linha está conectada; se não estiver, oriente a reconectar lendo o QR Code.
2. Confira os dados da operação: números válidos e, quando aplicável, se a linha tem permissão para agir naquele grupo.
3. Com a linha conectada e os dados corretos, peça para repetir a operação em alguns instantes e confirme na tela de Logs que o erro não aparece mais.

## Quando escalar
Se a operação de grupo continuar falhando com a linha conectada e os dados corretos, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.zapi.group_op_failed`, domínio do parceiro, o horário do evento, qual operação de grupo foi tentada e a mensagem/status devolvidos pela z-api.
