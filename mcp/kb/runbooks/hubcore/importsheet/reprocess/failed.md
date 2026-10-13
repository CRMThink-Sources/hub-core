---
category: integration
audience: suporte
summary: O reprocessamento das linhas com erro não pôde ser concluído; nenhuma linha foi alterada nesta tentativa.
---
# importsheet.reprocess.failed

## O que significa
O parceiro pediu para reprocessar as linhas com erro de uma importação, e a gravação dessas linhas no Bitrix24 falhou no meio. A lista de linhas com erro continua a mesma de antes: nada foi marcado como resolvido.

## Causa provável
- **Bitrix24 recusou a gravação**: permissão do app, campo obrigatório ou valor inválido que o Bitrix recusa para o lote inteiro.
- **Bitrix24 fora do ar ou lento** no momento do pedido.

## Como verificar
1. Na tela de Logs do app importsheet, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: importsheet.reprocess.failed`.
3. O log traz `importId` e o `err` com a resposta do Bitrix24.

## Como resolver
1. Erro de instabilidade (tempo esgotado, serviço indisponível): pedir para reprocessar de novo em instantes.
2. Recusa do Bitrix24 (permissão, campo): corrigir o que a mensagem aponta e reprocessar.

## Quando escalar
Se o reprocessamento falha sempre com a mesma mensagem e o parceiro já corrigiu o que ela aponta. Anexe: `traceKey`, `código de erro: importsheet.reprocess.failed`, domínio, id da importação e o `err`.
