# Proposal

## Why

A listagem de planos lê todos os itens da SPA 1138 de uma vez, e um único item mal cadastrado — hoje, um plano com o campo de intervalo (`UF_CRM_89_INTERVAL`) vazio — faz a leitura inteira falhar. Com isso caem a tela de contratação (planos ofertáveis), a listagem de assinaturas e o contexto da instalação, mesmo para clientes que não têm nada a ver com o plano quebrado.

## What Changes

- A listagem de planos passa a **descartar** os itens da SPA que não puderem ser lidos (intervalo vazio ou desconhecido, ou qualquer outro campo obrigatório inválido) e devolve os demais.
- Cada item descartado gera um aviso no log identificando o plano e os campos com problema, para correção no CRM.
- A leitura de **um plano específico** (por id) continua falhando quando o plano é inválido — quem pede aquele plano precisa saber que ele não é utilizável. Não há fallback para um intervalo default.

## Capabilities

### New Capabilities
- `pagamentos/catalogo-planos`: leitura do catálogo de planos da SPA de planos do Bitrix24 e o tratamento de registros mal cadastrados.

### Modified Capabilities
<!-- nenhuma -->

## Impact

- `api/src/modules/application/infra/bitrix/mappers/plan.mapper.ts` (`collectBitrixSpaPlanToRawPlan`) e seus testes.
- Consumidores de `getPlans()` deixam de receber erro por causa de um plano ruim: `list-offerable-plans`, `bitrix-subscriptions.repository`, `cached-plan.repository` e os scripts de backfill/checagem.
- Sem mudança de API, contrato HTTP ou cache — o cache passa a guardar a lista já filtrada.
