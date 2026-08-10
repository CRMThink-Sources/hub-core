---
category: validation
audience: suporte
summary: Um dos números informados é inválido.
---
# thinkzap.message.invalid_phone

## O que significa
O app thinkzap validou os números do envio antes de mandar e um deles não passou: está em formato inválido ou incompleto. Por isso a operação não seguiu. Não é falha da integração nem instabilidade: é um problema no número informado. Basta corrigir o número e repetir.

## Causa provável
- **Formato incorreto**: número sem DDI/DDD, com dígitos a mais ou a menos.
- **Número incompleto ou com caracteres inválidos**: campo preenchido de forma parcial ou com símbolos.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.message.invalid_phone`.
3. Veja no log qual número foi recusado.

## Como resolver
1. Confira o número informado: ele deve ter DDI e DDD corretos e a quantidade certa de dígitos.
2. Corrija o número e peça para repetir a operação.
3. Confirme na tela de Logs que o erro não aparece mais.

## Quando escalar
Se o número estiver claramente correto e ainda assim for recusado, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.message.invalid_phone`, domínio do parceiro, o horário do evento e o número informado.
