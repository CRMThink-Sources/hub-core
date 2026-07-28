---
category: integration
audience: dev
stub: true
summary: Falha ao gravar o dataset no Bitrix24 (biconnector.dataset.*).
---
# thinkanalise.bitrix.dataset_write_failed

## Direção (dev)
- **Causa provável:** Uma chamada `biconnector.dataset.*` no Bitrix24 retornou erro ao criar/atualizar o dataset.
- **Investigar:** Ler a linha de log com o `traceKey` e conferir o retorno da API Bitrix (método e mensagem), validando o vínculo com o source/connector.
