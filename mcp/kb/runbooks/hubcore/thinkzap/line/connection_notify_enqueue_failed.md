---
category: internal
audience: suporte
summary: O aviso de conexão/desconexão da linha não foi enviado aos destinatários configurados.
---
# thinkzap.line.connection_notify_enqueue_failed

## O que significa
A z-api avisou que uma linha conectou ou desconectou, e o aviso aos destinatários configurados não foi enfileirado. **O aviso não sai.** Numa desconexão, o cliente pode não saber que a linha caiu.

## Causa provável
- **Redis indisponível** no momento do webhook.

## Como verificar
1. Filtre os Logs pelo `instanceId` e confirme `código de erro: thinkzap.line.connection_notify_enqueue_failed`.
2. O `eventType` diz se foi conexão (`ConnectedCallback`) ou desconexão.

## Como resolver
1. Desconexão: avisar o cliente para ler o QR Code de novo na aba Conexão.
2. Conexão: nenhuma ação.

## Quando escalar
Se o erro é recorrente: o Redis precisa de atenção. Anexe a janela de horário e alguns `instanceId`.
