---
category: config
audience: dev
stub: true
summary: OAuth do Conta Azul sem clientId/authUrl no ambiente do servidor.
---
# thinkanalise.oauth.conta_azul_not_configured

## Direção (dev)
- **Causa provável:** As variáveis de ambiente do OAuth do Conta Azul (clientId/authUrl) não estão configuradas no servidor CRMThink.
- **Investigar:** Conferir a configuração de ambiente do CRMThink para o provider Conta Azul; sem clientId/authUrl o início do OAuth não monta.
