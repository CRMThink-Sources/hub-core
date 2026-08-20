---
category: internal
audience: dev
stub: true
summary: Não foi possível processar o documento porque ele estava travado por outra operação e o tempo de espera se esgotou.
---
# clicksign.lock.acquire_failed

## Direção (dev)
- **Causa provável:** Não foi possível obter o lock do documento no Redis dentro do tempo limite.
- **Investigar:** Verificar a saúde/contenção do Redis; muitos eventos concorrentes para o mesmo documento.
