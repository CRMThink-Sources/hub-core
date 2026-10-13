# Proposal

## Why

Quando o status de uma assinatura (SPA 1142) muda para `Cancelado` no CRM, as linhas dela continuam assinadas na Z-API e na HubMessage, e nós seguimos pagando por instância e canal de quem saiu. O fluxo Stripe já desassina pelo webhook do gateway. A assinatura manual não tem gatilho nenhum: o código diz que esse cancelamento é "de outra automação", e a change `isolar-homolog-e-assinar-linhas-spa` deixou a desassinatura pela 1142 explicitamente como trabalho futuro. Ela já trouxe a assinatura da linha manual para dentro do produto. Falta fechar o ciclo com a desassinatura.

## What Changes

- Quando a assinatura pai está `cancelled`, a regra única de cobrança (`resolveProviderBillingAction`) passa a devolver `unsubscribe` para todo item com credencial que ainda não tem a marca de desassinado, esteja o item `active` ou `cancelled`.
- O UPDATE da SPA 1142, que hoje já faz fan-out por item (`SyncSubscriptionLinesBilling`), passa a desassinar as linhas no provider quando o status lido da assinatura é `cancelled`:
  - Z-API: `POST /integrator/on-demand/cancel`.
  - HubMessage: `DELETE /v1/channels/:id/cancel`.
  Cada sucesso grava a marca `unsubscribedAt`. A falha em uma linha não trava as outras, e o job é retentado.
- A desassinatura vale para as duas modalidades (`manual` e `stripe`). Na Stripe ela costuma terminar em `noop`, porque o handler do gateway já desassinou e gravou a marca.
- Voltar a assinatura para `Ativo` reassina as linhas `active`. Isso já é coberto pela regra atual, porque a marca `unsubscribedAt` não conta como assinado.
- Só `cancelled` desassina. `past_due`, `trialing` e `trial_expired` continuam sem efeito no provider.
- O status do item (SPA 1146) não é alterado. A linha é bloqueada no app pelo entitlement, que já lê o status da assinatura.
- Cancelar num provider um recurso já cancelado ou nunca assinado é tratado como sucesso. Isso será validado em sandbox, como foi feito com o subscribe.
- Correção pontual: o `unsubscribe` do `ZApiClient` passa a lançar um código de erro próprio (`thinkzap.zapi.instance_unsubscribe_failed`), em vez de reutilizar o código do subscribe.

## Capabilities

### New Capabilities

_Nenhuma._

### Modified Capabilities

- `thinkzap/ciclo-provider-spa-assinatura`: três requisitos novos.
  - Cancelar a assinatura desassina as linhas.
  - Reativar a assinatura reassina as linhas ativas.
  - Cancelar um recurso já cancelado conta como sucesso.

  Os requisitos existentes, de assinatura e de fan-out na ativação, não mudam.

## Impact

- `api/src/modules/thinkzap/application/helpers/resolve-provider-billing-action.ts`: novo ramo para pai `cancelled`.
- `api/src/modules/thinkzap/application/sync-spa-item-resource-status.ts`: aceita o status do pai já lido pelo fan-out e desassina com origem própria quando o pai está cancelado.
- `api/src/modules/thinkzap/application/sync-subscription-lines-billing.ts`: lê o status da assinatura uma vez, repassa para cada item e conta as desassinaturas.
- `api/src/modules/thinkzap/application/provider-resource-billing.ts`: nova origem `subscription-cancelled` com motivo próprio. Atualiza o comentário de topo, que hoje diz que o cancelamento manual é de outra automação.
- `api/src/modules/thinkzap/infra/clients/z-api.client.ts`, `hubmessage.client.ts` e `errors/catalog.ts`: idempotência do cancel e o código de erro do unsubscribe.
- Testes dos itens acima.
- Sem mudança de API pública, de fila nem de variável de ambiente. A flag `THINKZAP_SPA_PROVIDER_EFFECTS_ENABLED` continua isolando homolog.
