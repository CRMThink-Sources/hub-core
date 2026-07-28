---
category: internal
audience: observabilidade
stub: true
summary: Reprocessamento pulado porque o lock de execução estava ocupado.
---
# importsheet.reprocess.skipped

## Direção (dev)
- **Causa provável:** O reprocessamento foi pulado porque o lock de execução estava ocupado.
- **Investigar:** Concorrência com um run em andamento; deve resolver ao tentar de novo depois que a execução liberar o lock.
