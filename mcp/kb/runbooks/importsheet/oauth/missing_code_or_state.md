---
category: auth
audience: observabilidade
stub: true
summary: O callback do OAuth chegou sem os parâmetros code ou state.
---
# importsheet.oauth.missing_code_or_state

## Direção (dev)
- **Causa provável:** O callback do OAuth chegou sem `code` ou sem `state`.
- **Investigar:** Redirecionamento do Google truncado ou acesso direto à URL de callback sem passar pelo fluxo.
