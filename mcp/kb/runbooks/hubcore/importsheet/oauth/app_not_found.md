---
category: internal
audience: dev
stub: true
summary: No callback do OAuth, o app não está instalado para o par appId+domain.
---
# importsheet.oauth.app_not_found

## Direção (dev)
- **Causa provável:** No callback, o app não foi encontrado como instalado para o `appId`+`domain`.
- **Investigar:** Consistência da instalação do app; `state` apontando para um app já removido.
