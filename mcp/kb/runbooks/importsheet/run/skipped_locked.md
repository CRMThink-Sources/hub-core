---
category: internal
audience: observabilidade
stub: true
summary: Execução pulada porque já havia outra rodada em andamento.
---
# importsheet.run.skipped_locked

## Direção (dev)
- **Causa provável:** A rodada foi pulada porque o lock de execução (Redis) já estava tomado por outra rodada em andamento.
- **Investigar:** Normalmente esperado — é a proteção contra rodada dupla. Só investigar se a importação nunca chega a rodar.
