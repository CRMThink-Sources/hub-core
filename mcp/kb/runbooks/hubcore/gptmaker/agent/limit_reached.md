---
category: validation
audience: suporte
stub: true
summary: Instalação já tem 5 agentes.
---
# gptmaker.agent.limit_reached

## Direção (suporte)
- **Causa provável:** O cliente tentou criar o 6º agente.
- **Investigar:** Nada a corrigir — o teto é do Bitrix (5 imbots por aplicação) e não varia por plano. O cliente precisa excluir um agente antes de criar outro. Agentes sem bot também contam: eles ocupam recurso no workspace compartilhado.
