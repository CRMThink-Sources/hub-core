---
category: internal
audience: observabilidade
stub: true
summary: A trava da importação não foi renovada durante a execução; se expirar, outra execução pode rodar em paralelo.
---
# importsheet.run.lock_renew_failed

## Direção (dev)
- **Causa provável:** Falha no Redis ao renovar o TTL do lock da importação durante uma página longa. O job segue; se o lock expirar antes do fim, outra execução pode pegar a mesma importação.
- **Investigar:** Saúde do Redis; se houver duplicatas na janela do log (`key`), revisar as linhas gravadas.
