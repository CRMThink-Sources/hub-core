---
category: integration
audience: dev
stub: true
summary: Falha ao gravar o conector no Bitrix24 (biconnector.connector.*).
---
# thinkanalise.bitrix.connector_write_failed

## Direção (dev)
- **Causa provável:** Uma chamada `biconnector.connector.*` no Bitrix24 retornou erro ao criar/atualizar o conector.
- **Investigar:** Ler a linha de log com o `traceKey` e conferir o retorno da API Bitrix (método e mensagem) pra separar erro de permissão/escopo de payload inválido.
