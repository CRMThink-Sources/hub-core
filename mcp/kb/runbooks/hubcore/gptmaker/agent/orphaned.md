---
category: internal
audience: dev
stub: true
summary: Agente criado no vendor sem linha local e sem compensação bem-sucedida.
---
# gptmaker.agent.orphaned

## Direção (dev)
- **Causa provável:** A gravação em `core_gpt_agents` falhou depois do `POST` no vendor, e o `DELETE` de compensação também falhou.
- **Investigar:** A linha de log traz `gptMakerAgentId` e `appId`. O agente existe no workspace compartilhado, cobra recurso e não pertence a ninguém. Rodar a reconciliação para confirmar e remover manualmente no painel do vendor.
