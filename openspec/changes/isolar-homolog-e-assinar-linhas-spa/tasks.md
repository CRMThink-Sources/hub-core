## 1. Flag de efeitos de provider (isolamento de homolog)

- [x] 1.1 Adicionar `THINKZAP_SPA_PROVIDER_EFFECTS_ENABLED` em `api/src/config/env.ts` como `env.payments.spa.providerEffectsEnabled`. Só o valor literal `'false'` desliga. Logar o valor efetivo no boot da API e dos workers
- [x] 1.2 Setar `THINKZAP_SPA_PROVIDER_EFFECTS_ENABLED=false` no staging e documentar em `DEPLOY.md`, na seção de portal compartilhado. Ficou em `environment:` do `docker-compose.staging.yml` (API e os dois workers de SPA), por cima do `api/.env` do servidor, porque `api/.env.staging` está no gitignore. Também foi documentada em `api/.env.example`
- [x] 1.3 Em `spa-webhook.controller.ts`, fazer `dispatchItemEffect` retornar cedo com a flag `false`, logando em `debug` (`verb`, `entityTypeId`, `itemId`), depois da invalidação de cache e mantendo a resposta `200`
- [x] 1.4 Adicionar `source: 'spa-webhook' | 'app'` ao `SpaItemResourceSyncJob` e ao job de provisionamento. O controller envia `spa-webhook`; `DeleteLine` (`make-line-controllers.ts`) envia `app`
- [x] 1.5 Nos processors `spa-item-provisioning.processor.ts` e `spa-item-resource-sync.processor.ts`, descartar jobs `source: 'spa-webhook'` com a flag `false` (outcome `disabled`, sem erro)
- [x] 1.6 Testes do controller (flag `false`: cache invalidado, 200, nenhum enqueue em ADD/UPDATE/DELETE da 1146 e UPDATE da 1142) e dos processors (descarta `spa-webhook`, processa `app`)

## 2. Marca de assinado no espelho

- [x] 2.1 Adicionar `subscribedAt?: string` em `SpaItemResourceMirror` e no schema zod de `spa-item-resource-mirror.keys.ts`
- [x] 2.2 Trocar `setUnsubscribed(itemId, bool)` por `setBillingState(itemId, 'subscribed' | 'unsubscribed')`. Grava uma marca e apaga a outra; sem espelho, é no-op. Atualizar a implementação Redis e os mocks de teste existentes
- [x] 2.3 Fazer `save` preservar `subscribedAt`/`unsubscribedAt` já existentes ao regravar o espelho
- [x] 2.4 Testes do repositório Redis: alternância das marcas, preservação no `save`, no-op sem espelho

## 3. Regra única de cobrança do item

- [x] 3.1 Criar o helper puro `resolveProviderBillingAction({ itemStatus, parent, mirror })` em `thinkzap/application/helpers/`, devolvendo `subscribe | unsubscribe | noop` com o motivo (design, decisão 4)
- [x] 3.2 Testes do helper cobrindo:
  - pai `active` manual e Stripe
  - pai trial (`trialing`/`trial_expired`)
  - pai `past_due`/`cancelled`
  - item cancelado com e sem marca
  - item ativo com marca `subscribed`
  - pai ausente
- [x] 3.3 Em `SyncSpaItemResourceStatus`, ler a assinatura pai pelo `parentId` (mesmo reader de `ProvisionLineFromSpaItem`), usar o helper e substituir os ramos `unsubscribe`/`resubscribe` por `unsubscribe`/`subscribe`. Chamar `ensureMirror` antes de marcar. Novo outcome `subscribed`; pai ausente vira `noop` com `warn`
- [x] 3.4 Atualizar `make-sync-spa-item-resource-status.ts` com a dependência nova
- [x] 3.5 Atualizar os testes de `sync-spa-item-resource-status`:
  - linha manual sem marca é assinada e marcada
  - UPDATE repetido é `noop`
  - trial nunca assina
  - reativação sob pai cancelado não assina (mudança de comportamento)
  - falha no provider não grava marca e propaga

## 4. Marca em todos os caminhos de subscribe/unsubscribe

- [x] 4.1 `ProviderResourceBilling`:
  - receber o `SpaItemResourceMirrorRepository` como dependência opcional
  - em `subscribe(item)`/`unsubscribe(item)` bem-sucedidos, chamar `setBillingState`
  - falha ao marcar vira `warn`, sem propagar
- [x] 4.2 Injetar o espelho em `makeSubscriptionDeps()` e nos demais factories que constroem `ProviderResourceBilling`
- [x] 4.3 Garantir que `activate-line-subscription.ts`, `create-additional-line.ts` e `provision-line-from-spa-item.ts` passam pelo caminho que marca. Ajustar os testes que mockam `setUnsubscribed`
- [x] 4.4 Atualizar o comentário de topo de `provider-resource-billing.ts`: a assinatura manual passa a ter gatilho no produto (UPDATE das SPAs 1146 e 1142)

## 5. Fan-out no UPDATE da SPA 1142

- [x] 5.1 Em `spa-item-resource-sync.queue.ts`, criar o job `sync-subscription-billing` (jobId `spa-subscription-billing-<subscriptionId>`, mesmas tentativas e backoff) e `enqueueSubscriptionBillingSyncJob`
- [x] 5.2 Criar o caso de uso `SyncSubscriptionLinesBilling`:
  - lista os ids dos itens com uma leitura crua e paginada (`BitrixSubscriptionItemIdLister`), não com `getSubscriptionItemsBySubscription`: o mapper estrito recusa item ainda não provisionado e derrubaria a listagem inteira
  - executa `SyncSpaItemResourceStatus` para cada um
  - coleta as falhas e lança no fim se alguma ocorreu
  - factory em `thinkzap/main/`
- [x] 5.3 Tratar o novo job em `spa-item-resource-sync.processor.ts`, respeitando a guarda da flag (1.5)
- [x] 5.4 No controller, criar `dispatchSubscriptionEffect`: UPDATE da SPA `subscriptionEntityType` enfileira o job, sob a guarda da flag. Falha de enqueue responde 200 e loga `error`. Ligar em `make-spa-webhook-controller.ts`
- [x] 5.5 Testes:
  - assinatura manual ativada assina as duas linhas (ZAPI e HUBMESSAGE)
  - falha em uma linha não impede a outra, e o job lança
  - retry não reassina a linha já marcada
  - controller enfileira no UPDATE da 1142 e ignora ADD/DELETE da 1142

## 6. Idempotência no provider e rollout

- [x] 6.1 Validar em sandbox a resposta da Z-API (`/integrator/on-demand/subscription`) e da HubMessage (`GET /v1/channels/:id/subscribe`) para um recurso já assinado. Se houver erro de "já assinado", tratá-lo como sucesso nos adapters, com teste. Resultado: Z-API responde `subscriptionStatus: ALREADY_ACTIVE` e HubMessage responde `type: ALREADY_PAID`. Os clients passam a tratar as duas respostas como sucesso (`isZApiAlreadySubscribed`, `isHubMessageAlreadyPaid`)
- [x] 6.2 (Se 6.1 não for idempotente) Script de backfill: grava `subscribedAt` no espelho dos itens `active` sob assinaturas Stripe `active`, com dry-run. Dispensado: o subscribe repetido é tolerado nos clients (6.1)
- [x] 6.3 Rodar `pnpm`/`npm` lint, typecheck e testes da API
- [ ] 6.4 Deploy em staging com a flag `false` e verificar no log que os eventos são recusados e que nenhuma instância nova é criada ao criar um item na SPA 1146
