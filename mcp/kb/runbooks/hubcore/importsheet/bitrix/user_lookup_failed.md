---
category: integration
audience: observabilidade
stub: true
summary: A busca do responsável da linha no Bitrix24 falhou, então a importação usou o responsável padrão.
---
# importsheet.bitrix.user_lookup_failed

## Direção (dev)
- **Causa provável:** `user.get` falhou (permissão, limite ou instabilidade do Bitrix24). Diferente de `import.responsible_unresolved`, aqui o usuário pode existir: a consulta é que não respondeu.
- **Investigar:** Escopo `user` do app e a resposta do Bitrix24 no `err`.
