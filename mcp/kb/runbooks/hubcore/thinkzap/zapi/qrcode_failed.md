---
category: integration
audience: suporte
summary: A z-api não devolveu o QR Code para conectar a linha de WhatsApp.
---
# thinkzap.zapi.qrcode_failed

## O que significa
Para conectar um WhatsApp não-oficial, o parceiro precisa ler um QR Code na aba Conexão. O app thinkzap pede esse QR Code à z-api, e neste caso a z-api recusou ou não respondeu. Por isso o QR Code não apareceu para o parceiro. É uma falha na integração externa com a z-api, normalmente passageira.

## Causa provável
- **Instabilidade da z-api**: o serviço estava indisponível ou lento no momento.
- **Linha já conectada ou em estado inválido**: a z-api pode não gerar QR Code se a linha não estiver aguardando conexão.
- **Status da z-api**: a conta na z-api pode estar com problema de status.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.zapi.qrcode_failed`.
3. Leia na linha do log o status e a mensagem devolvidos pela z-api.

## Como resolver
1. Peça ao parceiro para recarregar a aba Conexão em alguns instantes, para o app pedir o QR Code de novo.
2. Confirme o estado da linha: se ela já estiver conectada, não haverá QR Code a exibir.
3. Se persistir, verifique o status da z-api usando a mensagem do log e peça para recarregar depois que normalizar.

## Quando escalar
Se o QR Code continuar sem aparecer mesmo com a z-api aparentemente normal e a linha aguardando conexão, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.zapi.qrcode_failed`, domínio do parceiro, o horário do evento e a mensagem/status devolvidos pela z-api.
