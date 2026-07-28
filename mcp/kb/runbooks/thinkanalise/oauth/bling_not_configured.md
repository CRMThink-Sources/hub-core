---
category: config
audience: dev
stub: true
summary: OAuth do Bling sem configuração no ambiente do servidor.
---
# thinkanalise.oauth.bling_not_configured

## Direção (dev)
- **Causa provável:** A configuração de OAuth do Bling está ausente no ambiente do servidor CRMThink.
- **Investigar:** Conferir as variáveis de ambiente do CRMThink para o provider Bling (clientId/authUrl e correlatas); sem elas o início do OAuth não monta.
