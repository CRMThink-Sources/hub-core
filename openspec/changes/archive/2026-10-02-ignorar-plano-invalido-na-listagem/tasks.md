# Tasks

## 1. Listagem tolerante

- [x] 1.1 Alterar `collectBitrixSpaPlanToRawPlan` em `api/src/modules/application/infra/bitrix/mappers/plan.mapper.ts` para descartar itens que lançam `InvalidBitrixPlanError` (repropagando outros erros) e emitir `apiLogger.warn` com `planId` e campos; verificar que `tsc`/lint do `api` passam
- [x] 1.2 Adicionar testes em `plan.mapper.test.ts`: intervalo vazio entre válidos devolve só os válidos; intervalo desconhecido é descartado; todos inválidos devolve `[]`; o `warn` recebe id e campo `ufCrm89Interval`; verificar com `vitest run plan.mapper`
- [x] 1.3 Confirmar que os testes existentes de `mapBitrixSpaPlanToRawPlan` (intervalo `null`/desconhecido lançando `InvalidBitrixPlanError`) seguem passando, garantindo que a leitura por id continua estrita

## 2. Verificação

- [x] 2.1 Rodar a suíte do `api` (`vitest run`) e verificar que nenhum consumidor de `getPlans()` (`list-offerable-plans`, repositório de assinaturas, cache) quebra
