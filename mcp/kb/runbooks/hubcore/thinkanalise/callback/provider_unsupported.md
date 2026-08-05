---
category: config
audience: dev
stub: true
summary: O provider informado no callback não é suportado.
---
# thinkanalise.callback.provider_unsupported

## Direção (dev)
- **Causa provável:** O callback do BI trouxe um provider que não está entre os suportados (Asaas, Bling, Conta Azul, Omie, Sonax).
- **Investigar:** Ler a linha de log com o `traceKey` e conferir o valor de provider recebido vs. o mapa de providers suportados no CRMThink.
