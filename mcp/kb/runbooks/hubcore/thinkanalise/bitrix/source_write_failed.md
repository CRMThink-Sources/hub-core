---
category: integration
audience: dev
stub: true
summary: Falha ao gravar o source no Bitrix24.
---
# thinkanalise.bitrix.source_write_failed

## Direção (dev)
- **Causa provável:** Uma chamada `biconnector.source.*` no Bitrix24 retornou erro ao criar/atualizar o source.
- **Investigar:** Ler a linha de log com o `traceKey` e conferir o retorno da API Bitrix (método e mensagem), validando também o connectorId usado.
