---
category: validation
audience: suporte
summary: O template pedido não existe mais na linha.
---
# thinkzap.template.not_found

## O que significa
O app thinkzap tentou editar um template, ou definir a imagem padrão do envio de um template, e não encontrou esse template na conta do WhatsApp Oficial da linha. Nada foi alterado.

## Causa provável
- **Template excluído na Meta** depois de a tela ter sido aberta.
- **Tela desatualizada**: a lista de templates não foi sincronizada depois de mudanças feitas direto na Meta.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.template.not_found`.
3. Peça ao parceiro para sincronizar os templates da linha e conferir se o template ainda aparece.

## Como resolver
1. Oriente o parceiro a clicar em "Sincronizar" na aba de templates da linha.
2. Se o template não aparecer mais, ele foi excluído: é preciso criar um novo.
3. Se aparecer, peça para repetir a ação.

## Quando escalar
Se o template aparece na lista depois de sincronizar e o erro continua, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.template.not_found`, domínio do parceiro, o horário do evento e o nome do template.
