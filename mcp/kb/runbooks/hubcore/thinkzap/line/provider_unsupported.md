---
category: validation
audience: suporte
summary: Esta operação não está disponível para o tipo desta linha.
---
# thinkzap.line.provider_unsupported

## O que significa
A operação pedida não é compatível com a modalidade desta linha. Cada tipo de linha (WhatsApp comum, conectado por QR Code, versus WhatsApp Oficial) suporta um conjunto próprio de operações. O que se tentou fazer não existe para o tipo desta linha, então a operação não segue. Não é instabilidade nem erro de dados: é uma incompatibilidade de modalidade.

## Causa provável
- **Operação exclusiva da outra modalidade**: tentou-se uma ação que só o WhatsApp Oficial oferece em uma linha comum, ou o inverso.
- **Escolha equivocada**: o operador usou uma função que não se aplica ao tipo da linha.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.line.provider_unsupported`.
3. Confira a modalidade da linha na lista de linhas (WhatsApp comum, por QR Code, vs WhatsApp Oficial).

## Como resolver
1. Confira qual é a modalidade da linha e qual operação foi tentada.
2. Oriente o parceiro a usar a operação compatível com o tipo da linha.
3. Se a intenção depender de recursos de outra modalidade, explique que seria necessária uma linha desse outro tipo.

## Quando escalar
Se a operação for compatível com a modalidade da linha e ainda assim o erro aparecer, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.line.provider_unsupported`, domínio do parceiro, o horário do evento, o identificador da linha e a operação tentada.
