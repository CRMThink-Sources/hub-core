---
category: validation
audience: dev
stub: true
summary: Callback do OAuth chegou sem code/state.
---
# thinkanalise.oauth.callback_missing_params

## Direção (dev)
- **Causa provável:** O callback de retorno do OAuth chegou sem `code` e/ou `state`.
- **Investigar:** Ler a linha de log com o `traceKey` e conferir a query recebida no callback; verificar se o provider redirecionou corretamente ou se houve interrupção do fluxo.
