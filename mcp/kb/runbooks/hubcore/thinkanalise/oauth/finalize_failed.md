---
category: integration
audience: dev
stub: true
summary: A conexão foi autorizada, mas falhou ao finalizar (salvar o token ou atualizar o source).
---
# thinkanalise.oauth.finalize_failed

## Direção (dev)
- **Causa provável:** Após a troca do code, a finalização falhou ao salvar o token ou ao atualizar o source no Bitrix.
- **Investigar:** Ler a linha de log com o `traceKey` e verificar qual etapa da finalização quebrou (persistência do token vs. `biconnector.source.*`).
