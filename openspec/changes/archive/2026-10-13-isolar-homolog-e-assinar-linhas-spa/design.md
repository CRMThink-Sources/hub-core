# Design

## Context

- **Mesmo portal, dois consumidores.** O portal CRMThink tem dois "Webhooks de saída", um para a API de produção e outro para a de homolog, cada um com seu `BITRIX_SPA_WEBHOOK_TOKEN` (`api/.env.prod:25`, `api/.env.staging:25`). Todo evento das SPAs 1142 e 1146 chega aos dois ambientes.
- **Roteamento atual.** `spa-webhook.controller.ts`:
  - `dispatchItemEffect` (`:256-319`) só olha a SPA 1146.
  - ADD vai para `enqueueProvisioning`, UPDATE para `enqueueStatusSync`, DELETE para `enqueueCleanup`.
  - Nada no código distingue o ambiente. `NODE_ENV` só é usado pelo logger. O único discriminador existente é `env.payments.stripe.environment`, deduzido do prefixo da chave Stripe e usado só para escolher o price id.
- **Quem assina hoje.**
  - `activate-line-subscription.ts:296-307` (checkout Stripe).
  - `create-additional-line.ts:306`.
  - `provision-line-from-spa-item.ts:407`, só quando o pai é Stripe pago e não trial.
  - `SyncSpaItemResourceStatus` só reassina item `active` que tenha a marca `unsubscribedAt`.
  - A assinatura manual nunca é assinada. O comentário de `provider-resource-billing.ts:33-37` dizia que isso era papel de "automação fora do produto", e esta change traz a responsabilidade para dentro do produto.
- **Espelho do recurso.** O espelho (`SpaItemResourceMirror`, Redis, sem TTL) já guarda a credencial, o `subscriptionId` e a marca `unsubscribedAt`. `save` sobrescreve o valor inteiro.
- **UPDATE é ruidoso.** Toda escrita da própria API no item dispara UPDATE, por exemplo `UF_CRM_93_CONNECTED`. O payload do evento traz só o id, nunca o valor anterior.

## Goals / Non-Goals

**Goals:**
- Homolog não cria, não assina, não desassina e não limpa recursos de provider a partir de eventos das SPAs.
- Toda linha `active` com credencial, sob assinatura `active` e não trial, termina assinada no provider, seja ela manual ou Stripe.
- O subscribe é idempotente frente a UPDATEs repetidos.

**Non-Goals:**
- Desassinar linhas quando a assinatura 1142 vira `cancelled` ou `past_due` pelo CRM. Continua com o gateway (Stripe) e com o status do item. Pode virar change futura.
- Testar provisionamento real em homolog. Se for preciso, liga-se a flag num portal/SPA de teste dedicado, o que fica fora do escopo.
- Mudar o fluxo de trial (continua sem subscribe).

## Decisions

### 1. Flag explícita `THINKZAP_SPA_PROVIDER_EFFECTS_ENABLED`, padrão `true`
- **Decisão:** a guarda é uma env booleana em `env.thinkzap…`/`env.payments.spa.providerEffectsEnabled`. Só o valor literal `'false'` desliga. A flag é setada como `false` em `.env.staging`/`docker-compose.staging.yml` e documentada em `DEPLOY.md`.
- **Por quê:** é explícito e reversível sem deploy de código.
  - Padrão `true` evita que um env de produção mal configurado pare de provisionar.
  - Desligar sem querer em produção apareceria como "linha não provisiona". Ligar sem querer em homolog é o bug de hoje.
- **Alternativa descartada:** reaproveitar `env.payments.stripe.environment === 'homolog'`. Isso acopla o isolamento à chave Stripe, e um homolog com chave live (ou o inverso) quebraria em silêncio. O próprio `env.ts:19-27` justifica não usar `NODE_ENV`.
- **Alternativa descartada:** remover o webhook de saída de homolog no portal. Homolog perderia a invalidação de cache, que ainda é desejada.

### 2. A guarda fica no controller, depois da invalidação de cache e antes do enqueue
- **Decisão:** `dispatchItemEffect` e o novo `dispatchSubscriptionEffect` retornam cedo quando a flag é `false`, com log `debug` `{ app: 'payments', verb, entityTypeId, itemId }`. A invalidação de cache e a resposta `200` não mudam.
- **Defesa em profundidade:** os workers de `spa-item-provisioning` e `spa-item-resource-sync` também checam a flag e descartam jobs (outcome `disabled`). Isso cobre jobs já enfileirados antes do deploy da flag. O `QUEUE_PREFIX` de staging (`bull-staging`) isola as filas, então é barato.
- **Fora da guarda:** `DeleteLine` e os demais chamadores que enfileiram cleanup por conta própria, porque são ações do usuário dentro do próprio ambiente. A guarda do worker não pode bloquear esses jobs, então eles levam uma origem (`source: 'spa-webhook' | 'app'`) no payload, e só `spa-webhook` é descartado.

### 3. Marca de assinado `subscribedAt` no espelho, mutuamente exclusiva com `unsubscribedAt`
- **Decisão:**
  - Trocar `setUnsubscribed(itemId, bool)` por `setBillingState(itemId, 'subscribed' | 'unsubscribed')`, que grava uma marca e apaga a outra.
  - Se não houver espelho, é no-op, como hoje.
  - `save` (provisionamento) preserva as marcas existentes.
  - `SaveSpaItemResourceMirrorInput` continua sem as marcas.
- **Por quê:** o UPDATE não traz o valor anterior, então a comparação precisa de estado. Com uma única chave de estado, nunca existe "assinado e desassinado" ao mesmo tempo.
- **Espelho ausente** (linha anterior ao backfill): o caminho de subscribe chama `ensureMirror`, que já existe em `SyncSpaItemResourceStatus`, antes de marcar, igual ao unsubscribe.

### 4. Regra única de assinatura: `resolveProviderBillingAction(item, parent, mirror)`
- **Decisão:** um helper puro em `thinkzap/application/helpers/` devolve `subscribe | unsubscribe | noop` com o motivo:
  - `item.status === 'cancelled'` e sem marca `unsubscribed` → `unsubscribe` (comportamento atual).
  - `item.status === 'active'`, pai `active`, `!isTrialStatus(pai.status)` e marca diferente de `subscribed` → `subscribe`. Cobre a primeira assinatura e a reassinatura.
  - qualquer outro caso → `noop`.
- **Mudança de comportamento:** a reassinatura (item volta a `active`) passa a exigir pai `active` e não trial. Hoje ela reassina mesmo sob pai cancelado, o que nos faria pagar por linha de contrato encerrado.
- `SyncSpaItemResourceStatus` passa a ler o pai com o `SubscriptionRepository`/reader já usado por `ProvisionLineFromSpaItem` e usa o helper. Se o pai estiver ausente ou ilegível, o resultado é `noop` com `warn`.
- **Por que `active` e não também `past_due`:** inadimplência é transitória e não deve iniciar cobrança nova. Uma linha já assinada continua assinada, porque não é `unsubscribe`.

### 5. UPDATE da SPA 1142 vira fan-out por assinatura
- **Decisão:**
  - Novo `dispatchSubscriptionEffect` no controller: UPDATE com `entityTypeId === env.payments.spa.subscriptionEntityType` enfileira `sync-subscription-billing` na fila `spa-item-resource-sync`, com jobId `spa-subscription-billing-<id>`.
  - O caso de uso `SyncSubscriptionLinesBilling` lista os ids dos itens com uma leitura crua e paginada da SPA 1146 (`SubscriptionItemIdLister`). Não usa `getSubscriptionItemsBySubscription`: o mapper estrito recusa item com provider e sem credencial (manual ainda não provisionado), e um item desses derrubaria a listagem inteira. Para cada item, executa a mesma rotina de `SyncSpaItemResourceStatus` (reaproveitando o caso de uso item a item, sem reimplementar).
  - Erros são coletados por item. No fim, se houve falha, o job lança para a fila retentar.
  - Os itens já marcados ficam `noop` no retry, então nada é assinado duas vezes.
- **Por quê:** a assinatura manual costuma ser criada com os itens antes de o status virar `Ativo`. Sem esse gatilho, a linha só seria assinada no próximo toque no item.
- **Ruído:** UPDATE da 1142 também é frequente (escritas de período e status pelo gateway). O custo é uma listagem de itens e leituras do espelho. Não há chamada ao provider quando tudo já está marcado.

### 6. Todos os caminhos de subscribe gravam a marca
- **Decisão:**
  - `ProviderResourceBilling` ganha uma dependência opcional do `SpaItemResourceMirrorRepository`.
  - Depois de um `subscribe`/`unsubscribe` bem-sucedido sobre um item com id, chama `setBillingState`.
  - Falha ao gravar a marca vira `warn`, sem propagar. A consequência é no máximo um subscribe repetido.
- **Por quê:** centralizar evita que um chamador novo esqueça a marca. Os gatilhos via SPA (`propagate: true`) continuam marcando eles mesmos depois do `ensureMirror`.

### 7. Subscribe repetido no provider
Linhas Stripe já assinadas em produção não têm a marca. No primeiro UPDATE depois do deploy, elas recebem um subscribe repetido.
- **Decisão:** antes do deploy, validar em sandbox como a Z-API (`/integrator/on-demand/subscription`) e a HubMessage (`GET /v1/channels/:id/subscribe`) respondem a um recurso já assinado.
  - Se responderem erro do tipo "já assinado", os adapters tratam esse código como sucesso.
  - Opcional: um script de backfill grava `subscribedAt` para itens `active` sob assinaturas Stripe `active`, rodado uma vez em produção antes de ligar o novo ramo.

## Risks / Trade-offs

- **[Flag esquecida em produção como `false`]** → linhas não são provisionadas. Mitigação: o padrão é `true`, um `info` no boot loga o valor efetivo, e o checklist de deploy cobre isso.
- **[Corrida ADD × UPDATE]** → um UPDATE logo depois do ADD pode chegar antes de a credencial ser gravada. Resultado: `no-credential`/`noop`, e o próximo UPDATE (a própria escrita da credencial gera um) assina. É aceitável.
- **[Corrida entre o job do item e o fan-out da assinatura]** → os dois podem assinar o mesmo recurso ao mesmo tempo antes de qualquer marca. Mitigação: o subscribe tolera repetição (decisão 7). Opcional: lock Redis curto por `itemId` em volta do subscribe.
- **[Mudança na reassinatura]** → um item reativado sob assinatura cancelada deixa de ser reassinado. É intencional, mas muda o comportamento de suporte. Comunicar ao time.
- **[Homolog sem provisionamento]** → o QA de criação de linha em homolog pelo CRM deixa de criar instância. Os fluxos pelo app (trial e checkout) não dependem do webhook e seguem funcionando.

## Migration Plan

1. Deploy em staging com `THINKZAP_SPA_PROVIDER_EFFECTS_ENABLED=false` e confirmar no log que os eventos são recusados.
2. Validar em sandbox a idempotência do subscribe nos dois providers (decisão 7). Ajustar os adapters se for preciso.
3. (Opcional) Rodar o backfill de `subscribedAt` em produção.
4. Deploy em produção com a flag ausente ou `true`.
5. Rollback: reverter o código. A flag sozinha não reverte a regra nova de subscribe, só o isolamento.

## Open Questions

- ~~Como a Z-API e a HubMessage respondem a um subscribe em recurso já assinado?~~ Respondido em 2026-10-13: a Z-API responde `subscriptionStatus: ALREADY_ACTIVE` e a HubMessage responde `type: ALREADY_PAID`. Os clients tratam as duas como sucesso, então o backfill não é necessário.
- A assinatura manual pode ser criada já `Ativo` com itens adicionados depois? Se sim, o ADD do item provisiona e o UPDATE da própria escrita de credencial assina, o que já está coberto.
