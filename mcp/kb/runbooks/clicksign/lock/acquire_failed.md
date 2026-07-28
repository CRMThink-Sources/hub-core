---
category: internal
audience: dev
stub: true
summary: Não conseguiu obter o lock do documento no Redis (timeout).
---
# clicksign.lock.acquire_failed

## Direção (dev)
- **Causa provável:** Não foi possível obter o lock do documento no Redis dentro do tempo limite.
- **Investigar:** Verificar a saúde/contenção do Redis; muitos eventos concorrentes para o mesmo documento.
