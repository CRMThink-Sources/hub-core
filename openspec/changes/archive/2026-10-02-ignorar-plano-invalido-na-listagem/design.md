# Design

## Context

`BitrixPlanRepository.getPlans()` chama `collectBitrixSpaPlanToRawPlan`, que hoje é `raw.map(mapBitrixSpaPlanToRawPlan)`. O mapper valida com zod e lança `InvalidBitrixPlanError` quando algo falha — o intervalo vazio cai no `bitrixInterval`, que rejeita qualquer id fora de `INTERVAL_BY_BITRIX_ID` de propósito (cobrar no ciclo errado é pior que falhar). O `throw` de um item interrompe o `map` inteiro.

## Goals / Non-Goals

**Goals:**
- Um plano inválido não derruba a listagem.

**Non-Goals:**
- Tornar o mapper de item único tolerante: `getPlan(id)` continua lançando.
- Mudar o tratamento de assinaturas que apontam para o plano inválido. Hoje `bitrix-subscriptions.repository` busca por `getPlan(id)` os planos que não vieram na lista; uma assinatura ligada ao plano descartado continua falhando como já falhava antes — esta mudança não piora nem resolve esse caso.
- Default de intervalo.

## Decisions

- **Filtrar em `collectBitrixSpaPlanToRawPlan`, não no repositório.** O collect já é a função "da coleção"; o repositório e o cache não mudam. Alternativa (try/catch no `getPlans` do repositório) espalharia a regra e duplicaria o conhecimento do erro do mapper.
- **Descartar qualquer `InvalidBitrixPlanError`, não só intervalo.** O motivo é o mesmo para qualquer campo (um registro ruim não derruba o catálogo) e o resultado é falha fechada — o plano só some da oferta. Erros que não sejam `InvalidBitrixPlanError` continuam propagando.
- **`apiLogger.warn` por item descartado**, com `app: 'payments'`, `planId` e os paths das issues — mesma postura dos avisos já existentes no mapper (provider desconhecido, price id só no outro ambiente).
- Implementação com `flatMap` + try/catch em volta de `mapBitrixSpaPlanToRawPlan`, reaproveitando o mapper estrito.

## Risks / Trade-offs

- [Plano some silenciosamente do checkout] → aviso no log nomeia plano e campo.
- [Cache de 5 min guarda a lista filtrada] → após corrigir no CRM, o plano volta quando o cache expira ou é invalidado pelo webhook da SPA; comportamento igual ao de qualquer edição de plano.
