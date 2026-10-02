---
category: internal
audience: suporte
summary: Observabilidade — um evento de conexão/desconexão da z-api não foi enfileirado para atualizar o campo Conectado no CRM.
---
# thinkzap.line.connected_sync_enqueue_failed

## O que significa
A z-api avisou que uma linha conectou ou desconectou, e o job que atualiza o campo "Conectado" no CRM não foi enfileirado. A linha em si não é afetada. O campo fica com o valor anterior até o próximo evento.

## Causa provável
- **Redis indisponível** no momento do webhook.

## Como verificar
1. Filtre os Logs pelo `instanceId` e confirme `código de erro: thinkzap.line.connected_sync_enqueue_failed`.
2. Vários códigos de enfileiramento no mesmo minuto apontam o Redis fora.

## Como resolver
Nenhuma ação para o cliente. Se o CRM precisar refletir agora, ajustar o campo no item à mão.

## Quando escalar
Se o erro é recorrente: o Redis precisa de atenção. Anexe a janela de horário e alguns `instanceId`.
