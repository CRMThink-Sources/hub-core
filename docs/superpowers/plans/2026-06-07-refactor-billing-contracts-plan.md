# Refatoração do Sistema de Pagamentos — Contract-Centric Billing

## Context

Hoje o sistema usa Stripe como **única fonte de verdade** de billing. O comercial vende licença Bitrix por fora; quando incluem ThinkZap/ThinkAnalise na negociação, cobram por boleto manualmente e contornam a falta de boleto no sistema criando uma assinatura Stripe com **cupom de 100%**. Isso abre um gap crítico: o endpoint `POST /api/thinkzap/subscription/add-quantity` permite ao cliente adicionar linhas (instâncias Z-API WhatsApp) sem custo aparente, **sem nenhuma notificação ao comercial**, gerando linhas grátis não negociadas.

Não existe um modelo interno de contrato, quota negociada, responsável comercial ou método de pagamento. `BillingSubscription` apenas espelha o estado do Stripe.

**Objetivo:** introduzir um agregado interno `Contract` como fonte de verdade, com mirror em Bitrix SPA para visibilidade comercial e portal admin para gestão. Substituir o hack do cupom 100% por **boleto nativo Stripe**. Quando cliente fizer self-serve de linhas adicionais, **abrir Task no Bitrix** pro responsável comercial.

## Decisões alinhadas com o usuário

| Tópico | Decisão |
|---|---|
| Self-serve `add-quantity` com cap excedido | Permitir + notificar via Bitrix Task (tag `[EXCEDIDO]` quando passar contractedQuantity) |
| Source of truth do contrato | DB interno (`Contract` + `ContractItem`) — Stripe é execução, Bitrix SPA é mirror |
| Gestão pelo comercial | Bitrix SPA "Contratos" + portal admin `/admin/contratos` no front |
| Boleto | Stripe nativo (`payment_method_types: ['boleto']`) — substitui cupom 100% |
| Notificação self-serve | Bitrix Task no responsável comercial |
| Migração de subs existentes | Manual via portal admin |
| Topologia Stripe multi-produto | 1 subscription Stripe por Contract, com múltiplos `line_items` |
| Sync Bitrix ↔ App | Bidirecional (Bitrix outbound webhook → endpoint app re-pull) |
| Múltiplos Contracts ACTIVE no mesmo Domain | Permitido (ex.: ThinkZap em A, ThinkAnalise em B) |
| Gate `/admin/contratos` | Flag `isInternalUser` no banco (no User/BitrixUser) |
| Boleto não pago | Sem suspensão automática — fica PAST_DUE, comercial decide manualmente |
| Trial + Boleto | Trial roda sem cobrança (card opcional); conversão pode usar boleto |
| PIX dia 1 | Enum reservado, não wireado agora |
| ThinkAnalise dia 1 | Só esquema pronto (`ContractItem.product=THINKANALISE`), billing depois |

## Arquitetura proposta

```
┌─────────────────┐       1:N        ┌────────────────────┐
│    Contract     │ ───────────────► │   ContractItem     │
│ (DB interno)    │                  │ (produto + quota)  │
└────────┬────────┘                  └──────────┬─────────┘
         │ mirror                                │ link 1:1 ou 1:N
         ▼                                       ▼
┌─────────────────┐                  ┌────────────────────┐
│  Bitrix SPA     │                  │ BillingSubscription│
│  "Contratos"    │                  │ (cache estado      │
│ (visualização   │                  │  Stripe)           │
│  + edição       │                  └──────────┬─────────┘
│  comercial)     │                             │
└─────────────────┘                             ▼
                                     ┌────────────────────┐
                                     │  Stripe (boleto/   │
                                     │  card, multi-line) │
                                     └────────────────────┘
```

## Critical files a modificar / criar

### Modificar
- `api/prisma/schema.prisma` — add `Contract`, `ContractItem`, enums; back-relations em `Domain`, `App`, `BillingSubscription`; flag `isInternalUser` em `User`/`BitrixUser`.
- `api/src/modules/thinkzap/presentation/controllers/add-subscription-quantity.controller.ts` — emite evento `SelfServeQuantityChanged` após sync; tag `[EXCEDIDO]` quando ultrapassar `contractedQuantity`.
- `api/src/modules/thinkzap/presentation/controllers/create-subscription-checkout.controller.ts` — aceita `paymentMethod`, passa `payment_method_types: ['boleto','card']` quando boleto; metadata `contractId`.
- `api/src/modules/thinkzap/presentation/controllers/activate-trial.controller.ts` — auto-cria `Contract` DRAFT + `ContractItem` linkado.
- `api/src/shared/infra/handlers/stripe/checkout-session-completed.handler.ts` — se `metadata.contractId`, linka `BillingSubscription.id` no `ContractItem` certo, promove Contract → ACTIVE, resync SPA.
- `api/src/shared/infra/handlers/stripe/customer-subscription-updated.handler.ts` — `touch Contract.lastSyncedAt`; log `contract_drift_detected` quando Stripe qty > contractedQuantity.
- `api/src/shared/infra/handlers/stripe/customer-subscription-deleted.handler.ts` — marca Contract CANCELLED quando último item morre.
- `api/src/shared/domain/config/bitrix.env.ts` — `SPA_CONTRACT` entityTypeId + `BITRIX_SPA_CONTRACT_FIELDS`.
- `api/src/shared/infra/clients/bitrix.client.ts` — método `createTask(...)`.
- `api/src/app.ts` — mount `/api/contracts`, mount `/api/bitrix/spa-contract/webhook` (inbound bidirectional sync).

### Criar — Backend `api/src/modules/contracts/`
Seguir Clean DDD/Hexagonal (`clean-ddd-hexagonal` skill já no repo). Mirror estrutural de `api/src/modules/thinkzap/`:
```
api/src/modules/contracts/
├── application/
│   ├── create-contract.use-case.ts
│   ├── update-contract.use-case.ts
│   ├── change-contract-status.use-case.ts
│   ├── link-stripe-subscription.use-case.ts       # migração manual
│   ├── adjust-contracted-quantity.use-case.ts
│   ├── list-contracts.use-case.ts
│   └── handlers/notify-comercial-on-self-serve.handler.ts
├── domain/
│   ├── contract-permissions.ts                    # scope contracts:{read,create,update,delete}
│   └── events/self-serve-quantity-changed.event.ts
├── presentation/controllers/
│   ├── create-contract.controller.ts
│   ├── update-contract.controller.ts
│   ├── list-contracts.controller.ts
│   ├── get-contract.controller.ts
│   ├── link-stripe-subscription.controller.ts
│   ├── change-status.controller.ts
│   ├── adjust-quantity.controller.ts
│   └── bitrix-spa-contract-webhook.controller.ts  # inbound do Bitrix
├── main/
│   ├── make-*-controller.ts (1 por controller)
│   └── bootstrap-contract-event-handlers.ts
└── routes.ts
```

### Criar — Domain entities e ports
- `api/src/shared/domain/entities/contract.ts` — entidade + enums `ContractStatus`, `ContractPaymentMethod`, `ContractBillingCycle`. Helpers: `isQuantityWithinCap()`, `canSelfServeAdd()`.
- `api/src/shared/domain/entities/contract-item.ts` — entidade + enum `ContractProduct`.
- `api/src/shared/domain/entities/spa-contract.ts` — entidade do mirror Bitrix.
- `api/src/shared/domain/repositories/contract/` — ports CRUD + `link-billing-subscription.repository.ts`.
- `api/src/shared/domain/repositories/bitrix-task/create-bitrix-task.repository.ts`.
- `api/src/shared/domain/repositories/spa-contract/` — ports CRUD.
- `api/src/shared/domain/events/domain-event.ts` + `api/src/shared/infra/events/in-process-event-bus.ts` (reusar pattern do `event-registry.ts`).
- `api/src/shared/application/sync-contract-to-bitrix-spa.use-case.ts`.
- `api/src/shared/domain/utils/generate-contract-code.ts` (`CT-{YYYY}-{seq6}`).

### Criar — Infra adapters
- `api/src/shared/infra/persistence/repositories/prisma-contract.repository.ts`
- `api/src/shared/infra/persistence/repositories/prisma-contract-item.repository.ts`
- `api/src/shared/infra/persistence/repositories/bitrix-spa-contract.repository.ts` (pattern de `bitrix-spa.repository.ts`)
- `api/src/shared/infra/persistence/repositories/bitrix-task.repository.ts`

### Criar — Webhooks Stripe (boleto)
- `api/src/shared/infra/handlers/stripe/invoice-payment-action-required.handler.ts` (boleto aguardando)
- `api/src/shared/infra/handlers/stripe/invoice-payment-failed.handler.ts` (boleto expirado/recusado → marca PAST_DUE, **não suspende**)
- `api/src/shared/infra/handlers/stripe/invoice-paid.handler.ts` (confirma quitação)

### Criar — Frontend `front/app/(admin)/admin/contratos/`
```
front/app/(admin)/admin/contratos/
├── page.tsx                              # list
├── novo/page.tsx                         # create
└── [id]/
    ├── page.tsx                          # detail/edit
    └── vincular-stripe/page.tsx          # migração legacy
```
Componentes em `front/components/layouts/admin/`:
- `admin-contracts-page.tsx`, `admin-contracts-table.tsx`
- `admin-contract-detail-page.tsx`, `admin-contract-form.tsx`
- `admin-contract-link-stripe-form.tsx`
API client em `front/lib/api/contracts.ts` (verificar convenção `front/lib/api/*`).
Wrap rotas com `AdminAuthGuard` + `AdminShell` (mesmo padrão de `front/app/(admin)/admin/clientes/page.tsx`).

## Schema diff sketch (Prisma)

```prisma
enum ContractStatus { DRAFT ACTIVE SUSPENDED CANCELLED }
enum ContractPaymentMethod { BOLETO CARD PIX LEGACY_COUPON }
enum ContractBillingCycle { MONTHLY YEARLY }
enum ContractProduct { THINKZAP THINKANALISE }

model Contract {
  id                              String                 @id @default(uuid())
  code                            String                 @unique                  // CT-2026-000001
  domainId                        String                 @map("domain_id")
  status                          ContractStatus         @default(DRAFT)
  paymentMethod                   ContractPaymentMethod
  billingCycle                    ContractBillingCycle   @default(MONTHLY)
  responsibleComercialBitrixUserId Int                   @map("responsible_comercial_bitrix_user_id")
  bitrixSpaContractId             String?                @map("bitrix_spa_contract_id")
  stripeSubscriptionId            String?                @unique @map("stripe_subscription_id")   // 1 sub por Contract
  signedAt                        DateTime?              @map("signed_at")
  startsAt                        DateTime?              @map("starts_at")
  endsAt                          DateTime?              @map("ends_at")
  notes                           String?                @db.Text
  lastSyncedAt                    DateTime?              @map("last_synced_at")
  createdAt                       DateTime               @default(now()) @map("created_at")
  updatedAt                       DateTime               @updatedAt @map("updated_at")
  domain Domain         @relation(fields: [domainId], references: [id])
  items  ContractItem[]
  @@index([domainId])
  @@index([status])
  @@index([responsibleComercialBitrixUserId])
  @@map("contracts")
}

model ContractItem {
  id                    String          @id @default(uuid())
  contractId            String          @map("contract_id")
  appId                 String          @map("app_id")
  product               ContractProduct
  contractedQuantity    Int             @map("contracted_quantity")
  unitPriceCents        Int?            @map("unit_price_cents")
  billingSubscriptionId String?         @map("billing_subscription_id")          // sem @unique — 1 sub serve múltiplos items
  createdAt             DateTime        @default(now()) @map("created_at")
  updatedAt             DateTime        @updatedAt @map("updated_at")
  contract            Contract             @relation(fields: [contractId], references: [id], onDelete: Cascade)
  app                 App                  @relation(fields: [appId], references: [id])
  billingSubscription BillingSubscription? @relation(fields: [billingSubscriptionId], references: [id])
  @@unique([contractId, product])
  @@index([appId])
  @@index([product])
  @@map("contract_items")
}

// Em BillingSubscription:
//   paymentMethod   String?           @map("payment_method")
//   lastStripeSyncedAt DateTime?      @map("last_stripe_synced_at")
//   contractItems   ContractItem[]
// (manter connectorQuantity como cache do Stripe — não remover)

// Em User (ou BitrixUser, conforme a tabela existente para usuários internos):
//   isInternalUser  Boolean @default(false) @map("is_internal_user")
```

## Reuso de patterns existentes

| Pattern | Onde reusar |
|---|---|
| Factory `make-*-controller.ts` | Todos os novos controllers de `contracts/` |
| `EventRegistry` (`api/src/shared/infra/handlers/event-registry.ts`) | Base do `in-process-event-bus.ts` |
| `BitrixSpaRepository` (`api/src/shared/infra/persistence/repositories/bitrix-spa.repository.ts`) | Pattern para `bitrix-spa-contract.repository.ts` |
| `requireThinkzapPermission` (`api/src/modules/thinkzap/routes.ts`) | Pattern para `requireContractPermission` + nova middleware `requireInternalUser` (checa `User.isInternalUser`) |
| `AdminAuthGuard`, `AdminShell` em front | Wrap das rotas `/admin/contratos` |

## Rollout (sprints sugeridos)

| Sprint | Entrega | Dep |
|---|---|---|
| 1 | Phase A (schema + ports + repos) + Phase B parcial (boleto aditivo no checkout) | — |
| 2 | Bitrix admin setup (SPA "Contratos" + UF fields) + `bitrix-spa-contract.repository.ts` + sync use-case | 1 |
| 3 | Phase E (portal admin + API contracts + migração manual) | 1, 2 |
| 4 | Phase C (event bus + Bitrix Task on self-serve) + Phase F (refactors trial + webhooks) | 1, 2, 3 |
| 5 | Webhook inbound Bitrix → app (bidirectional sync) | 3 |

## Verificação end-to-end

### Sprint 1
- `npx prisma migrate dev --name add_contracts_and_contract_items` (local).
- Unit tests: `Contract.canSelfServeAdd`, `generateContractCode`, ports/adapters básicos.
- Stripe CLI: `stripe trigger checkout.session.completed` com metadata `paymentMethod=boleto` → conferir checkout session no Dashboard com boleto habilitado.

### Sprint 2-3
- Criar manualmente um Contract via `POST /api/contracts` → ver row em `contracts` no DB → ver SPA "Contratos" no Bitrix.
- Test integration: `link-stripe-subscription.use-case.test.ts` mockando Stripe + Bitrix.

### Sprint 4 (cenário completo)
1. Comercial cria Contract DRAFT (paymentMethod=BOLETO, 3 linhas ThinkZap) via `/admin/contratos/novo`.
2. SPA aparece no Bitrix "Contratos".
3. Cliente recebe link checkout → completa pagando com boleto.
4. Webhook `checkout.session.completed` → `BillingSubscription` criada, `ContractItem` linkado, Contract → ACTIVE, SPA resincronizado.
5. Cliente paga boleto → webhook `invoice.paid`.
6. Cliente chama `POST /api/thinkzap/subscription/add-quantity` adicionando 1 linha (total 4 > cap 3).
7. **Bitrix Task aparece** pro `responsibleComercialBitrixUserId` com título `[EXCEDIDO] Cliente {domain} adicionou linhas ThinkZap`, link pra `/admin/contratos/{id}` e SPA.
8. Webhook `customer.subscription.updated` → `Connector` provisionado, `Contract.lastSyncedAt` tocado, log `contract_drift_detected` emitido.

### Sprint 5
- Editar campo no SPA Bitrix → outbound webhook Bitrix → `POST /api/bitrix/spa-contract/webhook` → re-pull → `Contract` atualizado em DB.

## Pontos de atenção operacional

- **Setup Bitrix manual obrigatório** antes do Sprint 2: criar SPA "Contratos" no admin Bitrix, capturar `entityTypeId` + UF field codes, popular `BITRIX_SPA_CONTRACT_FIELDS` em `bitrix.env.ts`.
- **Fallback responsible** pra eventos órfãos (sub legada sem Contract ainda migrado): env var `CONTRACTS_FALLBACK_BITRIX_USER_ID` recebe Task no lugar.
- **Drift detector** (futuro, fora dessa refatoração): Cron que compara `Stripe.subscription.quantity` vs `sum(ContractItem.contractedQuantity)` e abre Task quando > N% de drift sem Task aberta.
- **Webhook inbound Bitrix** precisa assinatura HMAC ou IP allowlist — definir no Sprint 5.
