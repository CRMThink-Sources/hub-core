---
category: auth
audience: dev
stub: true
summary: O Google não devolveu refresh_token e não havia um anterior salvo.
---
# importsheet.oauth.refresh_token_missing

## Direção (dev)
- **Causa provável:** O Google não retornou `refresh_token` e não existia um anterior salvo.
- **Investigar:** Consentimento sem `access_type=offline`/`prompt=consent`; conta que já havia consentido antes (Google omite o refresh_token na reautorização).
