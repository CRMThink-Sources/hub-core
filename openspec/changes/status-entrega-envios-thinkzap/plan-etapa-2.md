# Status de entrega, etapa 2 (Entregue e Lido, linha oficial) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gravar "Entregue" e "Lido" dos envios da linha oficial (HubMessage) e mostrá-los no rodapé do comentário do CRM.

**Architecture:** O webhook de status da HubMessage já cai na fila `thinkzap-inbound` (`source: 'hubmessage-status'`). O processor passa a gravar `deliveredAt`/`readAt` na row do outbox e a agendar a atualização do comentário (o mesmo `publishSendState` da etapa 1). O status exibido é derivado das colunas, e só avança.

**Tech Stack:** TypeScript, Prisma 7 (MariaDB), BullMQ, Vitest.

**Spec:** `openspec/changes/status-entrega-envios-thinkzap/design.md` (etapa 2) e este arquivo.

## Eventos reais observados (produção, 27/11/2026)

| `contents[0].state.name` | `contents[0].type` | Significa |
|---|---|---|
| `RECEIVED` (`@class: ".Received"`) | `DeliveryCallback` | Entregue ao aparelho |
| `READ` (`@class: ".Read"`) | `MessageStatusCallback` | Lido |
| `SENT` | (não observado o corpo) | Aceite da Meta: não muda nada, "Enviado" já existe |
| `ERROR` (`.Failed`) | já tratado na etapa 1 | Recusa |

- Cada transição tem `identifier` próprio e `moment` em **segundos**; o `message._id` é o `providerMessageId` gravado no envio (confirmado no banco).
- `RECEIVED` chega pelo evento `MESSAGE_DELIVERY` (assinado em todos os canais); `READ` só nos canais que assinam `MESSAGE_STATUS` (9 de 17 em produção). Por isso o evento entra em `HUBMESSAGE_CHANNEL_WEBHOOK_EVENTS`.
- Muitos eventos são de envios fora do outbox (resposta do operador, bot): devem ser ignorados em silêncio.

## Global Constraints

- Comandos dentro de `api/`; yarn. Front não muda.
- Só envios rastreados (`isTrackedSend`); campanha de SMS, `OPERATOR` e `BOT` não mudam de comportamento.
- **Não afirmar o que o provedor não confirmou:** só `RECEIVED` vira Entregue e só `READ` vira Lido. Estado desconhecido, `SENT` e o resto são ignorados (log). O caminho de campanha de SMS (`reportCampaignStatus`) **não é alterado** nesta etapa.
- O status só avança: Lido > Entregue > Enviado. Evento atrasado ou repetido não regride nem duplica (`updateMany` condicional por coluna nula).
- Entregue ou lido prevalece sobre uma recusa registrada (design); o conflito vai para o log.
- Registrar status nunca lança para o despacho nem muda `status` da fila; nenhuma chamada nova ao provider.
- Evento sem row: reagenda poucas vezes (10 s, 60 s) e desiste em silêncio, **sem** virar falha de recebimento.
- Textos em pt, en e es. Comentários de código e commits em português; CRLF; sem ponto e vírgula; mocks tipados.
- Migration nova e só aditiva; nunca editar as existentes nem `prisma/generated`.
- Sem código de erro novo.

## Review Focus

1. READ chegando antes do RECEIVED (ou sem ele) mostra Lido; RECEIVED depois de READ não regride (Tasks 1 e 4).
2. Mesmo evento entregue duas vezes: uma gravação, e o comentário não é editado à toa (Task 4).
3. Evento de envio fora do outbox (operador, bot, SMS): sem escrita, sem erro, no máximo duas retentativas (Task 4).
4. Recusa registrada e depois `READ` do mesmo envio: mostra Lido e loga o conflito; o aviso de falha não dispara de novo (Tasks 1 e 4).
5. Lista de mais de 20 destinatários com Entregues/Lidos: totais corretos e linhas só das falhas (Task 3).

---

### Task 1: Status de entrega no domínio

**Files:**
- Modify: `api/src/modules/thinkzap/domain/send-notice.ts`
- Modify: `api/src/modules/thinkzap/domain/send-notice.test.ts`
- Modify: `api/src/modules/thinkzap/application/helpers/send-failure.ts` (o `toSendPart` repassa os campos novos)

**Interfaces — Produces:**

```ts
export type RecipientState = 'WAITING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'PARTIAL' | 'UNKNOWN'
export type SendPart = { /* campos atuais */ deliveredAt: Date | null; readAt: Date | null }
```

Regras: uma parte com `rejectedAt` **e** (`deliveredAt` ou `readAt`) **não** é falha (entrega prevalece). Sem falha e sem `UNKNOWN`, e sem parte na fila: todas as partes com `readAt` = `READ`; senão todas com `deliveredAt` ou `readAt` = `DELIVERED`; senão `SENT` (o menor avanço entre as partes). `PARTIAL` continua exigindo uma parte `SENT` sem falha (entregue ou lida conta como saída). `failureCount` não muda.

- [ ] **Step 1: Testes que falham** (em `send-notice.test.ts`; `part()` ganha `deliveredAt: null, readAt: null`):

```ts
it('lido sem entregue anterior mostra READ', () => {
  expect(summarizeRecipients([part({ status: 'SENT', readAt: new Date() })])[0]!.state).toBe('READ')
})
it('entregue em uma parte e só enviada na outra mostra SENT (o menor avanço)', () => {
  const parts = [part({ status: 'SENT', deliveredAt: new Date() }), part({ status: 'SENT' })]
  expect(summarizeRecipients(parts)[0]!.state).toBe('SENT')
})
it('entregue prevalece sobre recusa registrada', () => {
  const [r] = summarizeRecipients([part({ status: 'SENT', rejectedAt: new Date(), deliveredAt: new Date() })])
  expect(r!.state).toBe('DELIVERED')
  expect(r!.failedPart).toBeNull()
})
it('recusa sem entrega segue FAILED', () => {
  expect(summarizeRecipients([part({ status: 'SENT', rejectedAt: new Date() })])[0]!.state).toBe('FAILED')
})
it('failureCount ignora DELIVERED e READ', () => { /* dois destinatários READ e DELIVERED -> 0 */ })
```

- [ ] **Step 2:** `yarn test src/modules/thinkzap/domain/send-notice.test.ts` — FAIL.
- [ ] **Step 3:** Implementar; ajustar `toSendPart` e todo lugar que monta `SendPart`/`RecipientState` (`yarn check-types` aponta). Não mexer em `send-comment.ts` (Task 3).
- [ ] **Step 4:** PASS e `yarn check-types`.
- [ ] **Step 5:** Commit "Deriva Entregue e Lido no status do envio".

### Task 2: Colunas e repositório

**Files:**
- Modify: `api/prisma/schema.prisma` (`ThinkzapWidgetOutbox`)
- Create: `api/prisma/migrations/<timestamp posterior ao último>_add_delivery_read_to_thinkzap_outbox/migration.sql`
- Modify: `api/src/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository.ts` (+ teste)

**Interfaces — Produces:**
- Colunas nulas `delivered_at` e `read_at` (`DATETIME(3)`), sem índice.
- `WidgetOutboxRecord` e `OutboxRow`/`mapRow` ganham `deliveredAt: Date | null` e `readAt: Date | null`.
- `markDelivered(id: string, at: Date): Promise<boolean>` e `markRead(id: string, at: Date): Promise<boolean>`: `updateMany` com `where: { id, deliveredAt: null }` / `{ id, readAt: null }`; `true` quando gravou.

- [ ] **Step 1: Testes que falham:** os dois métodos usam exatamente esses `where` e `data: { deliveredAt: at }` / `{ readAt: at }`; devolvem `false` com `count === 0`.
- [ ] **Step 2:** `yarn test src/modules/thinkzap/infra/persistence` — FAIL.
- [ ] **Step 3:** Schema (comentário explicando por que colunas separadas: o evento pode chegar fora de ordem), SQL escrita à mão (só `ADD COLUMN` nulo; **não** rodar `migrate dev/deploy` em banco nenhum), `yarn prisma:generate`, repositório. Ajustar fixtures de `WidgetOutboxRecord` dos testes existentes.
- [ ] **Step 4:** `yarn test src/modules/thinkzap && yarn check-types` — PASS.
- [ ] **Step 5:** Commit "Guarda quando o envio foi entregue e lido".

### Task 3: Comentário com Entregue e Lido

**Files:**
- Modify: `api/src/modules/thinkzap/domain/notices/send-comment.ts` e `send-comment.test.ts`

**Interfaces — Consumes:** `RecipientState` da Task 1.

Cópia: `DELIVERED` = `Entregue` / `Delivered` / `Entregado`; `READ` = `Lido` / `Read` / `Leído`. O título (`commentTitle`) trata `SENT`, `DELIVERED` e `READ` como "enviado" (`sentTitle`/`robotTitle` quando **todos** estão nesse conjunto). Na lista acima de 20 destinatários, `DELIVERED` e `READ` somam aos totais e **não** ganham linha individual (como `SENT`). Nenhum aviso "confira antes de reenviar" para eles.

- [ ] **Step 1: Testes que falham:** rodapé de um destinatário `READ` termina em `[B]Status:[/B] Lido`; `DELIVERED` em en é `Delivered`; título de envio todo `DELIVERED` é o título de enviado; 22 destinatários (20 `READ` + 2 `DELIVERED`) mostram totais por estado sem linhas individuais; um `FAILED` no meio continua detalhado.
- [ ] **Step 2:** `yarn test src/modules/thinkzap/domain/notices/send-comment.test.ts` — FAIL.
- [ ] **Step 3:** Implementar (estender `COPY.states` nos três idiomas; ajustar os filtros que hoje comparam com `'SENT'`).
- [ ] **Step 4:** PASS; `yarn check-types`.
- [ ] **Step 5:** Commit "Mostra Entregue e Lido no comentário do envio".

### Task 4: Gravar o progresso a partir do webhook

**Files:**
- Create: `api/src/modules/thinkzap/application/record-delivery-progress.ts` + teste
- Modify: `api/src/modules/thinkzap/application/process-hubmessage-delivery-status.use-case.ts` + teste
- Modify: `api/src/workers/hubmessage-status.processor.ts` + teste

**Interfaces — Produces:**

```ts
export type ProgressKind = 'delivered' | 'read'
export type ProgressResult = 'recorded' | 'duplicate' | 'untracked' | 'row-missing' | 'ignored'
/** `RECEIVED` -> delivered, `READ` -> read; qualquer outro estado -> null. */
export function progressKindOf(stateItem: HubMessageStateItem | undefined): ProgressKind | null
export const PROGRESS_RETRY_DELAYS_MS = [10_000, 60_000] as const
export function recordDeliveryProgress(
  input: { instanceId: string; providerMessageId: string; stateItem: HubMessageStateItem | undefined },
  deps: {
    outbox: Pick<PrismaWidgetOutboxRepository, 'findByProviderMessageId' | 'markDelivered' | 'markRead'>
    publish: (outboxId: string) => Promise<void>
    now: () => Date
  },
): Promise<ProgressResult>
```

Regras: `progressKindOf` lê `stateItem.state.name` (`'RECEIVED'`, `'READ'`; outro = `null`). `recordDeliveryProgress`: sem tipo → `'ignored'`; sem row → `'row-missing'`; row não rastreada → `'untracked'`; senão grava com `at` = `moment` do item (segundos × 1000) quando for um número válido, senão `deps.now()`; chama `publish(row.id)` **sempre** (também em `'duplicate'`, como a recusa na etapa 1: a publicação é idempotente); se a row já tem `rejectedAt`, loga `warn` (`deliveryAfterRejection: true`, sem texto de mensagem) e segue gravando.

Integração no use case: estados `RECEIVED`/`READ` (não são recusa) chamam o registro novo (dep opcional `recordProgress`) logo depois de achar a instância e **antes** do caminho de campanha, com o mesmo tratamento de erro que `recordRejection` (nunca lança; `row-missing` ou erro reagenda). A escala de retentativas é a do estado: recusa usa `REJECTION_RETRY_DELAYS_MS` (5 passos), progresso usa `PROGRESS_RETRY_DELAYS_MS` (2). A execução com `recordOnlyAttempt` continua só registrando, sem avisar o chat nem reportar campanha. O processor repassa a dep, e o atraso do job de retentativa vem da escala do estado (`jobId` e `traceKey` como hoje). O caminho de campanha e o aviso ao chat ficam **idênticos**.

- [ ] **Step 1: Testes que falham**
  - `progressKindOf`: `RECEIVED` → `'delivered'`, `READ` → `'read'`, `SENT`/`ERROR`/`undefined` → `null`.
  - `recordDeliveryProgress`: `READ` chama `markRead` com `at` de `moment * 1000`; `RECEIVED` chama `markDelivered`; segunda entrega devolve `'duplicate'` e ainda publica; `SENT` devolve `'ignored'` sem tocar o repositório; row de campanha de SMS devolve `'untracked'` sem escrever; sem row devolve `'row-missing'`; row com `rejectedAt` grava e loga `deliveryAfterRejection`.
  - Use case: `RECEIVED` chama `recordProgress` e **também** segue para o caminho de campanha (`reportSmsStatus` com `delivered`, como hoje); `row-missing` agenda a tentativa 1 com 10 s e a tentativa 2 com 60 s; na 3ª não agenda e não lança; erro ao gravar reagenda; execução `recordOnly` de um `READ` não notifica o chat nem reporta campanha; os testes de recusa existentes seguem passando.
  - Processor: o atraso do job de retentativa de um `READ` usa a escala de progresso.
- [ ] **Step 2:** `yarn test record-delivery-progress process-hubmessage hubmessage-status sms-delivery-status` — FAIL nos novos.
- [ ] **Step 3:** Implementar; reaproveitar o `scheduleOrGiveUp` generalizando a escala (não duplicar).
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit "Registra Entregue e Lido a partir do webhook da HubMessage".

### Task 5: Assinar o evento de status nos canais

**Files:**
- Modify: `api/src/modules/thinkzap/infra/clients/types/hubmessage.types.ts` (`HUBMESSAGE_CHANNEL_WEBHOOK_EVENTS`)
- Modify: os testes que fixam a lista (`hubmessage-connector-provider.test.ts` e outros que a comparem)
- Modify: `api/src/scripts/sync-hubmessage-channel-webhook-events.ts` (só comentário, se a doc do script precisar)

**Interfaces — Produces:** `HUBMESSAGE_CHANNEL_WEBHOOK_EVENTS` passa a incluir `'MESSAGE_STATUS'` (depois de `MESSAGE_DELIVERY`); canais novos já nascem assinando. O JSDoc explica o porquê (Lido só chega por ele) e que os canais existentes precisam do script `hubmessage:sync-channel-webhook-events` (não executar aqui).

- [ ] **Step 1: Teste que falha:** o provider cria o webhook com os cinco eventos na ordem `MESSAGE_RECEIVED`, `MESSAGE_DELIVERY`, `MESSAGE_STATUS`, `CONNECTED`, `DISCONNECTED`; o teste do script de sincronização (se existir) considera `MESSAGE_STATUS` como evento exigido.
- [ ] **Step 2:** `yarn test hubmessage-connector-provider sync-hubmessage` — FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** PASS; `yarn test src/modules/thinkzap` (nenhum outro teste depende da lista antiga).
- [ ] **Step 5:** Commit "Assina o evento de status dos canais da HubMessage".

### Task 6: Verificação final

- [ ] `cd api && yarn check-types && yarn lint && yarn test` — sem erros nem warnings.
- [ ] Atualizar `openspec/changes/status-entrega-envios-thinkzap/tasks.md`: etapa 2 (linha oficial) implementada; validar em staging (rodar `hubmessage:sync-channel-webhook-events` nos 8 canais sem `MESSAGE_STATUS`, enviar um template e ver Enviado → Entregue → Lido no comentário, `READ` antes de `RECEIVED`, envio de operador sem escrita); **Z-API continua pendente** (sem amostra do `MessageStatusCallback`); observação: o caminho de campanha de SMS reporta `delivered` para qualquer estado sem erro (inclusive `SENT`), comportamento anterior preservado de propósito.
- [ ] Commit "Registra as validações pendentes da etapa 2".
