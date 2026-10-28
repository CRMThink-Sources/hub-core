---
category: validation
audience: suporte
summary: O template atingiu o limite de edições da Meta.
---
# thinkzap.template.edit_limit_reached

## O que significa
A Meta recusou a edição de um template do WhatsApp Oficial porque ele atingiu o limite de edições. Para templates aprovados, a Meta permite uma edição por dia e até dez em 30 dias. O template continua como estava, com o mesmo status.

## Causa provável
- **Várias edições seguidas** do mesmo template aprovado.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.template.edit_limit_reached`.

## Como resolver
1. Oriente o parceiro a esperar o prazo da Meta (no mínimo 24 horas desde a última edição) e tentar de novo.
2. Se a mudança for urgente, oriente a criar um template novo com o texto atualizado.

## Quando escalar
Se o template não foi editado nos últimos dias e o erro continua, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.template.edit_limit_reached`, domínio do parceiro, o horário do evento e o nome do template.
