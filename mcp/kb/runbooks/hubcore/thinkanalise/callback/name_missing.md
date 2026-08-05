---
category: validation
audience: dev
stub: true
summary: O callback de descrição chegou sem o nome da tabela.
---
# thinkanalise.callback.name_missing

## Direção (dev)
- **Causa provável:** O callback de descrição (describe) chegou sem o nome da tabela a descrever.
- **Investigar:** Ler a linha de log com o `traceKey` e conferir o parâmetro de nome da tabela no payload do describe.
