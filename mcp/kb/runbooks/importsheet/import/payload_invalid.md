---
category: validation
audience: dev
stub: true
summary: Os dados da importação foram reprovados na validação.
---
# importsheet.import.payload_invalid

## Direção (dev)
- **Causa provável:** O payload da importação foi reprovado na validação (mensagem genérica de Zod).
- **Investigar:** Ler `issues[0].message` no log para o campo específico; normalmente o front deveria barrar antes.
