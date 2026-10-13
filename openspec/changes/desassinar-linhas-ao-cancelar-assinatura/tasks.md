# Tasks

## 1. Cancelamento idempotente nos providers

- [x] 1.1 Validar em sandbox a resposta da Z-API (`POST /instances/:id/token/:token/integrator/on-demand/cancel`) e da HubMessage (`DELETE /v1/channels/:id/cancel`) em dois casos: recurso já cancelado e recurso nunca assinado. Registrar no `design.md` (decisão 4) o status HTTP e o corpo de cada resposta. Para verificar, a decisão 4 deve ter as respostas documentadas. Resultado: Z-API `200` com `{ due, id, token }`; HubMessage `204`, exigindo a query `cancel=true`.
- [x] 1.2 Adicionar `thinkzap.zapi.instance_unsubscribe_failed` em `api/src/modules/thinkzap/errors/catalog.ts` e usar esse código em `ZApiClient.unsubscribe` (`z-api.client.ts`). Verificar com um teste novo em `z-api.client.test.ts` que uma falha do cancel lança o código novo.
- [x] 1.3 Se a 1.1 encontrou uma resposta identificável, criar `isZApiAlreadyCancelled` em `z-api.client.ts` e `isHubMessageAlreadyCancelled` em `hubmessage.client.ts`, no padrão de `isZApiAlreadySubscribed`/`isHubMessageAlreadyPaid`. `unsubscribe`/`cancelChannel` passam a tratar essa resposta como sucesso. Verificar com testes em `z-api.client.test.ts` e `hubmessage.client.test.ts`: a resposta "já cancelado" resolve e um erro genérico continua lançando. Se a 1.1 não encontrou resposta identificável, registrar isso no design e aplicar o ajuste local da regra descrito em Risks. Resultado: nenhum dos dois devolve erro de "já cancelado", então não houve predicado. `cancelChannel` passou a enviar `cancel=true`, com teste em `hubmessage.client.test.ts`.

## 2. Regra de cobrança com pai cancelado

- [x] 2.1 Em `helpers/resolve-provider-billing-action.ts`, adicionar o ramo "pai `cancelled` e sem `unsubscribedAt` → `unsubscribe`", avaliado antes dos ramos de assinatura (decisão 1). Incluir `reason: 'item-cancelled' | 'parent-cancelled'` no `unsubscribe` e restringir `parent-inactive` a `past_due`. Atualizar o JSDoc com a tabela nova.
- [x] 2.2 Atualizar `resolve-provider-billing-action.test.ts` e verificar que passam os casos:
  - pai `cancelled` com item `active` assinado → `unsubscribe`/`parent-cancelled`
  - pai `cancelled` com item `active` sem marca → `unsubscribe`
  - pai `cancelled` com item já `unsubscribedAt` → `noop`/`in-sync`
  - pai `cancelled` com item `cancelled` sem marca → `unsubscribe`
  - pai `past_due` com item assinado → `noop`
  - pai `trial_expired` → `noop`
  - pai `null` com item assinado → `noop`

## 3. Origem do cancelamento no provider

- [x] 3.1 Em `provider-resource-billing.ts`, adicionar a origem `subscription-cancelled` com o motivo `'Assinatura cancelada no CRM'` em `REASON_BY_ORIGIN`. Reescrever o trecho do comentário de topo que diz que o cancelamento do contrato manual "continua fora daqui". Verificar com um teste em `provider-resource-billing.test.ts` que `unsubscribeResource(ref, { origin: 'subscription-cancelled' })` envia esse motivo ao adapter.

## 4. Caso de uso do item aceita o status do pai

- [x] 4.1 Em `sync-spa-item-resource-status.ts`, adicionar `parentStatus?: Subscription['status'] | null` ao input. Com o campo presente, usar esse valor sem ler o pai. Com o campo ausente, manter a leitura preguiçosa atual. Passar `decision.reason` ao `unsubscribe` privado e escolher a origem: `subscription-cancelled` para `parent-cancelled`, `spa-item-status` para `item-cancelled`. Ajustar a mensagem do log `info` conforme o motivo.
- [x] 4.2 Atualizar `sync-spa-item-resource-status.test.ts` e verificar:
  - `parentStatus: 'cancelled'` no input desassina o item assinado, sem chamar o `SubscriptionStatusReader`, com origem `subscription-cancelled`, e grava `unsubscribed`
  - sem `parentStatus`, um item assinado não lê o pai (comportamento atual preservado)
  - sem `parentStatus`, um item `active` sem marca sob pai lido como `cancelled` é desassinado
  - falha no provider não grava a marca e propaga

## 5. Fan-out da assinatura desassina

- [x] 5.1 Em `sync-subscription-lines-billing.ts`, receber o `SubscriptionStatusReader`, ler o status uma vez antes do loop e repassar `parentStatus` para cada `syncItem.execute`. Adicionar `unsubscribed` ao resultado. Logar em `info` quando `subscribed + unsubscribed > 0`. Atualizar o JSDoc da classe, que hoje fala só da ativação. Injetar o reader em `main/make-sync-subscription-lines-billing.ts`. Verificar com o typecheck da API.
- [x] 5.2 Atualizar `sync-subscription-lines-billing.test.ts` e verificar:
  - assinatura cancelada com duas linhas (ZAPI e HUBMESSAGE) repassa `parentStatus: 'cancelled'` e conta `unsubscribed: 2`
  - falha em uma linha não impede a outra, e o job lança `SubscriptionLinesBillingError`
  - o status do pai é lido uma única vez por execução
  - status `null` é repassado sem desassinar

## 6. Integração e rollout

- [x] 6.1 Rodar lint, typecheck e a suíte de testes da API (`api/`) e verificar que terminam sem erro. Resultado: 322 arquivos e 3366 testes passando. Para isso foram corrigidos 3 testes desatualizados fora do escopo: trial de 7 dias, `DEL_EXTERNAL_MESSAGES` ligado e planos dependentes da chave Stripe.
- [ ] 6.2 Em staging (flag `false`), editar uma assinatura de teste na 1142 para `Cancelado` e verificar no log que o evento só invalida cache e que nenhum job de provider é enfileirado.
- [ ] 6.3 Em produção, cancelar uma assinatura manual de teste com uma linha Z-API e uma HubMessage. Verificar o log `info` com `unsubscribed: 2` e o cancelamento agendado no painel de cada provider. Depois voltar a assinatura para `Ativo` e verificar que as duas linhas são assinadas de novo, com a marca `subscribedAt` no espelho.
