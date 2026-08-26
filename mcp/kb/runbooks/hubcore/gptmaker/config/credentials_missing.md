---
category: config
audience: suporte
stub: true
summary: GPTMAKER_API_TOKEN ou GPTMAKER_WORKSPACE_ID ausente no ambiente da API.
---
# gptmaker.config.credentials_missing

## Direção (suporte)
- **Causa provável:** Deploy sem as variáveis do GPT Maker. A credencial é compartilhada por todas as instalações — não existe token por cliente.
- **Investigar:** Conferir `GPTMAKER_API_TOKEN` e `GPTMAKER_WORKSPACE_ID` no ambiente da API. O módulo sobe sem elas de propósito (para não derrubar as outras apps), então o sintoma aparece só na primeira criação de agente.
