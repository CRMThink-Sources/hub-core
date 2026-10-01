---
category: integration
audience: suporte
summary: Os dados da linha não puderam ser lidos agora (CRM interno ou provider não respondeu como esperado).
---
# thinkzap.line.billing_read_failed

## O que significa
Uma tela de linha (QR Code, conexão, ajustes, SMS, templates) não conseguiu ler os dados da linha. A leitura vem do CRM interno (assinatura, item, plano, produto) ou do provider. A resposta foi `502`: a linha pode existir, só não foi possível lê-la agora.

## Causa provável
- **CRM interno (Bitrix24) indisponível** ou lento.
- **Item, assinatura ou plano com formato inválido** na SPA (campo obrigatório vazio).
- **Provider fora**.

## Como verificar
1. Filtre os Logs pelo `traceKey` e confirme `código de erro: thinkzap.line.billing_read_failed`.
2. O `err.type` diz a origem: `BitrixError` aponta o CRM fora; `InvalidBitrix*Error` aponta dado inválido na SPA (a mensagem diz o campo).

## Como resolver
1. `BitrixError`: recarregar em instantes.
2. `InvalidBitrix*Error`: corrigir o campo indicado no item, assinatura ou plano da SPA.

## Quando escalar
Se o dado está correto na SPA e o erro persiste. Anexe: `traceKey`, domínio, `err.type` e `err.message`.
