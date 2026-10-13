---
category: integration
audience: dev
summary: A verificação ou o reparo da instalação no Bitrix24 falhou.
---
# clicksign.provisioning.bitrix_error

## Direção (dev)
- **Causa provável:** `ProvisioningService.check()`/`repair()` recebeu erro do Bitrix24 (permissão, método inexistente, instabilidade). A tela recebe 400.
- **Investigar:** Resposta do Bitrix24 no `err`; escopos do app no portal.
