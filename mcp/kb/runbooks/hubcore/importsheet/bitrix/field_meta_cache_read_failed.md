---
category: internal
audience: observabilidade
stub: true
summary: Falha ao ler os dados de campos guardados temporariamente; o app buscou direto no Bitrix24.
---
# importsheet.bitrix.field_meta_cache_read_failed

## Direção (dev)
- **Causa provável:** Falha ao ler o cache de meta de campos no Redis; o app recarrega a meta direto do Bitrix24.
- **Investigar:** Saúde do Redis (benigno, só gera custo extra de chamada ao Bitrix24).
