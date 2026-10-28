---
category: validation
audience: suporte
summary: O template não pode ser editado como foi pedido.
---
# thinkzap.template.not_editable

## O que significa
O app thinkzap recusou a edição de um template do WhatsApp Oficial, ou a Meta recusou. As regras da Meta são: template em análise não pode ser editado; nome e idioma nunca mudam; a categoria de um template aprovado não muda. O template continua como estava.

## Causa provável
- **Template em análise** (pendente): a Meta ainda não respondeu à criação ou à edição anterior.
- **Troca de nome, idioma ou categoria** de um template aprovado.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.template.not_editable` e leia a mensagem do erro.
3. Na aba de templates da linha, confira o status do template.

## Como resolver
1. Se o template está em análise, oriente o parceiro a aguardar a resposta da Meta e sincronizar antes de editar.
2. Se o parceiro precisa de outro nome, idioma ou categoria, oriente a criar um template novo.

## Quando escalar
Se o template está aprovado ou rejeitado, nada disso foi alterado e o erro continua, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.template.not_editable`, domínio do parceiro, o horário do evento e o nome do template.
