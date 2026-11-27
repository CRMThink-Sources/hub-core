# Status de entrega, etapa 1 (recusas e falhas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gravar toda recusa ou falha de envio por widget e robô Bizproc, mostrar o status no rodapé de um comentário que é atualizado, notificar quem enviou e guardar o histórico por 90 dias.

**Architecture:** A row do outbox ganha os campos de recusa e aponta para um "aviso de envio" (um por disparo, tabela nova). Todo desfecho apenas **agenda** o aviso numa fila própria; dois jobs agrupados releem o banco e publicam/editam o comentário e notificam. O texto do comentário é uma função pura das rows.

**Tech Stack:** TypeScript, Prisma 7 (MariaDB), BullMQ, Vitest, REST do Bitrix24.

**Spec:** `openspec/changes/status-entrega-envios-thinkzap/design.md`

## Global Constraints

- Comandos dentro de `api/`; gerenciador `yarn`. Front não muda nesta etapa.
- Escopo: origens `WIDGET`, `WIDGET_ATTACHMENT`, `ROBOT_MESSAGE`, `ROBOT_BUTTONS`, `ROBOT_TEMPLATE`, **sem** `smsMessageId`. Campanha de SMS (que usa origem `WIDGET` no template), `OPERATOR` e `BOT` não mudam de comportamento.
- Envio síncrono (anexo do widget e robô "Enviar mensagem" com `THINKZAP_UNIFIED_OUTBOX_DOMAINS` desligada) não cria row: mantém o comentário atual, sem status.
- Registrar status, comentar ou notificar **nunca** lança para o despacho nem muda `status` da fila. Nenhuma chamada nova ao provider.
- `crm.timeline.comment.add` não é retentado; `crm.timeline.comment.update` pode ser.
- Chamadas ao Bitrix só pelo `BitrixClient` (limites em `shared/infra/bitrix-limits`).
- Texto do usuário e do provedor em BBCode sempre por `escapeBbcode`/`bbField`/`bbMessage`.
- Textos em pt, en e es. Comentários de código e commits em português; CRLF; sem ponto e vírgula.
- Mocks tipados pelo contrato (`vi.fn<Repo['metodo']>`).
- Migration nova; nunca editar as existentes nem `prisma/generated`.
- Sem código de erro novo: falhas deste fluxo usam `thinkzap.message.widget_send_notice_failed`.
- Retenção: env `THINKZAP_SEND_HISTORY_DAYS`, padrão `90`, inteiro >= 1.
- Janelas: comentário 15 s, notificação 120 s. Lista detalhada até 20 destinatários.

## Review Focus

1. Redis fora na hora de agendar o aviso: o envio segue `SENT`, sem exceção, com log (Task 5).
2. A mesma recusa entregue duas vezes: um só `rejectedAt` e uma só notificação (Tasks 2 e 7).
3. Recusa antes de a row gravar o `providerMessageId`: reagenda só o registro, sem repetir o aviso no chat (Task 10).
4. Template de campanha de SMS (origem `WIDGET` com `smsMessageId`): fica fora (Task 1).
5. Motivo do provedor ou destinatário com `[url]`: aparece como texto (Task 3).

---

### Task 1: Escopo e status por destinatário (domínio puro)

**Files:**
- Create: `api/src/modules/thinkzap/domain/send-notice.ts`
- Test: `api/src/modules/thinkzap/domain/send-notice.test.ts`

**Interfaces — Produces:**

```ts
export const TRACKED_SEND_ORIGINS = ['WIDGET', 'WIDGET_ATTACHMENT', 'ROBOT_MESSAGE', 'ROBOT_BUTTONS', 'ROBOT_TEMPLATE'] as const
export function isTrackedSend(row: { origin: string; smsMessageId: string | null }): boolean
export type RecipientState = 'WAITING' | 'SENT' | 'FAILED' | 'PARTIAL' | 'UNKNOWN'
export type SendPart = {
  destination: string
  status: 'PENDING' | 'SENDING' | 'SENT' | 'FAILED' | 'UNKNOWN'
  rejectedAt: Date | null
  lastError: string | null
  failureCode: string | null
  failureReason: string | null
}
export type RecipientSummary = { destination: string; state: RecipientState; failedPart: SendPart | null }
/** Um item por destino, na ordem da primeira aparição. */
export function summarizeRecipients(parts: SendPart[]): RecipientSummary[]
export function isSettled(parts: SendPart[]): boolean
export function failureCount(recipients: RecipientSummary[]): number
```

Precedência por destinatário: recusada (`rejectedAt`) conta como falha. Alguma falha e alguma parte `SENT` sem recusa = `PARTIAL`; alguma falha sem nenhuma entregue = `FAILED`; senão algum `UNKNOWN` = `UNKNOWN`; senão algum `PENDING`/`SENDING` = `WAITING`; senão `SENT`. `failedPart` é a primeira parte com falha (ou `UNKNOWN`). `failureCount` conta `FAILED`, `PARTIAL` e `UNKNOWN`.

- [ ] **Step 1: Testes que falham**

```ts
it('template de campanha de SMS fica fora', () => {
  expect(isTrackedSend({ origin: 'WIDGET', smsMessageId: 'm1' })).toBe(false)
  expect(isTrackedSend({ origin: 'WIDGET', smsMessageId: null })).toBe(true)
  expect(isTrackedSend({ origin: 'OPERATOR', smsMessageId: null })).toBe(false)
})
it('recusa posterior ao aceite vira FAILED', () => {
  const [r] = summarizeRecipients([part({ status: 'SENT', rejectedAt: new Date() })])
  expect(r!.state).toBe('FAILED')
})
it('uma parte saiu e outra falhou é PARTIAL', () => {
  const [r] = summarizeRecipients([part({ status: 'SENT' }), part({ status: 'FAILED' })])
  expect(r!.state).toBe('PARTIAL')
})
it('espera enquanto houver parte pendente', () => {
  const parts = [part({ status: 'SENT' }), part({ status: 'PENDING' })]
  expect(summarizeRecipients(parts)[0]!.state).toBe('WAITING')
  expect(isSettled(parts)).toBe(false)
})
```

(`part()` é um helper do teste com todos os campos nulos e `destination: '5511999999999'`.)

- [ ] **Step 2:** `yarn test src/modules/thinkzap/domain/send-notice.test.ts` — FAIL (módulo inexistente).
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Mesmo comando — PASS.
- [ ] **Step 5:** Commit "Define escopo e status por destinatário dos envios".

### Task 2: Banco e repositórios

**Files:**
- Modify: `api/prisma/schema.prisma` (`ThinkzapWidgetOutbox` e modelo novo)
- Create: `api/prisma/migrations/<timestamp posterior ao último>_add_send_notices_to_thinkzap/migration.sql`
- Modify: `api/src/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository.ts`
- Create: `.../repositories/prisma-send-notice.repository.ts`
- Test: `.../repositories/prisma-send-notice.repository.test.ts` e o teste do outbox no mesmo diretório (padrão de mock do `prisma` dos testes vizinhos)

**Interfaces — Produces:**

- Colunas em `core_thinkerszap_widget_outbox`: `send_notice_id` (nulo), `rejected_at` (nulo), `failure_code` (nulo), `failure_reason` (TEXT, nulo). Índices `(instance_id, provider_message_id)` e `(send_notice_id)`. Sem chave estrangeira.
- Modelo `ThinkzapSendNotice` (`core_thinkerszap_send_notices`): `id`, `dispatchKey` único, `domainId`, `appCode`, `entity`, `entityId`, `operatorBitrixUserId?`, `eager` (default false), `commentId?` (String), `commentAsAuthor` (default false), `commentClaimedAt?`, `fromPhone?`, `alertedFailures` (default 0), `createdAt`, `updatedAt`; índice em `createdAt`.
- `WidgetOutboxRecord` e `CreateWidgetOutboxInput` ganham `sendNoticeId`; o record ganha também `rejectedAt`, `failureCode`, `failureReason`.

```ts
// PrismaWidgetOutboxRepository
markRejected(id: string, input: { code: string | null; reason: string; at: Date }): Promise<boolean> // updateMany com rejectedAt: null
linkSendNotice(where: { rowId: string; dispatchGroupId: string | null }, noticeId: string): Promise<void> // grupo inteiro, só onde send_notice_id é nulo
findBySendNotice(noticeId: string): Promise<WidgetOutboxRecord[]> // por partIndex, depois createdAt

// PrismaSendNoticeRepository
ensure(input: { dispatchKey: string; domainId: string; appCode: string; entity: string; entityId: string; operatorBitrixUserId: string | null; eager?: boolean }): Promise<SendNoticeRecord> // upsert por dispatchKey, sem sobrescrever
findById(id: string): Promise<SendNoticeRecord | null>
claimComment(id: string, at: Date): Promise<boolean>
saveComment(id: string, input: { commentId: string; asAuthor: boolean }): Promise<void>
saveFromPhone(id: string, phone: string): Promise<void>
saveAlerted(id: string, failures: number): Promise<void>
deleteExpiredBatch(cutoff: Date, limit: number): Promise<number>
```

- [ ] **Step 1: Testes que falham:** `markRejected` chama `updateMany` com `where: { id, rejectedAt: null }` e devolve `false` quando `count === 0`; `claimComment` usa `where: { id, commentClaimedAt: null }`; `ensure` usa `upsert` com `update: {}`.
- [ ] **Step 2:** `yarn test src/modules/thinkzap/infra/persistence` — FAIL.
- [ ] **Step 3:** Schema, SQL (somente `ADD COLUMN` nulo, `CREATE INDEX`, `CREATE TABLE`) e repositórios; `yarn prisma:generate`. Incluir os campos em `OutboxRow` e `mapRow`.
- [ ] **Step 4:** `yarn test src/modules/thinkzap && yarn check-types` — PASS (ajustar fixtures de `WidgetOutboxRecord` com os campos novos).
- [ ] **Step 5:** Commit "Guarda recusa e aviso de envio no outbox do ThinkZap". Pedir revisão do agente `guardiao-migrations` se a execução usar subagentes.

### Task 3: Texto do comentário e da notificação

**Files:**
- Create: `api/src/modules/thinkzap/domain/notices/send-comment.ts`
- Test: `.../domain/notices/send-comment.test.ts`

**Interfaces — Consumes:** `RecipientSummary`, `SendPart` (Task 1); `bbTitle`, `bbField`, `bbMessage`, `bbLines`.

```ts
export type SendCommentInput = {
  locale: NoticeLocale
  kind: 'message' | 'template' | 'buttons'
  automation: boolean
  fromPhone: string
  template?: { name: string; language: string }
  text: string
  recipients: RecipientSummary[]
  files?: { sent: string[]; failed: { name: string; reason: SendRobotFileFailure }[] }
  describeFailure: (part: SendPart) => string
}
export function renderSendComment(input: SendCommentInput): string
export function renderSendAlert(input: { locale: NoticeLocale; failed: number; unknown: number; reason: string | null; recordUrl: string | null }): string
```

Cópia (pt / en / es): rótulo `Status`; estados `Aguardando envio`/`Waiting to be sent`/`Esperando envío`, `Enviado`/`Sent`/`Enviado`, `Falhou: {motivo}`/`Failed: {reason}`/`Falló: {motivo}`, `Falhou em parte: {motivo}`/`Partially failed: {reason}`/`Falló en parte: {motivo}`, `Sem confirmação`/`Not confirmed`/`Sin confirmación`. Título, `De`, `Para`, `Template`, `Mensagem` e arquivos reaproveitam os textos de `timeline-notices.ts` (exportar o que for preciso); título é `sentTitle` ou `robotTitle` (automation). `Sem confirmação` acrescenta `unknownAction`. Template aparece como `nome (idioma)`.

Layout: um destinatário → `Para:` e rodapé `Status:` na última linha. Vários → `Para:` com a quantidade; até 20, uma linha `número — estado` por destinatário; acima de 20, totais por estado e linhas só das falhas e sem confirmação.

- [ ] **Step 1: Testes que falham**

```ts
it('um destinatário: status no rodapé', () => {
  const text = renderSendComment(base({ recipients: [sent('5511999999999')] }))
  expect(text.split('\n').at(-1)).toBe('[B]Status:[/B] Enviado')
  expect(text).toContain('[B]De:[/B] 5511888888888')
})
it('template oficial mostra nome e idioma', () => {
  expect(renderSendComment(base({ template: { name: 'boas_vindas', language: 'pt_BR' } })))
    .toContain('[B]Template:[/B] boas_vindas (pt_BR)')
})
it('motivo do provedor não vira marcação', () => {
  const text = renderSendComment(base({ recipients: [failed('551')], describeFailure: () => '[url]x[/url]' }))
  expect(text).not.toContain('[url]')
})
it('acima de 20 destinatários detalha só as falhas', () => {
  const text = renderSendComment(base({ recipients: [...sentMany(24), failed('5599')] }))
  expect(text).toContain('5599')
  expect(text).not.toContain(sentMany(24)[0]!.destination)
})
```

- [ ] **Step 2:** `yarn test src/modules/thinkzap/domain/notices/send-comment.test.ts` — FAIL.
- [ ] **Step 3:** Implementar. A notificação diz quantas falharam e quantas ficaram sem confirmação (sem afirmar que não saíram), o motivo quando for um só e `[URL=...]` para o registro.
- [ ] **Step 4:** PASS, incluindo um caso por idioma.
- [ ] **Step 5:** Commit "Monta o comentário de envio com status por destinatário".

### Task 4: Publicar e editar o comentário

**Files:**
- Modify: `api/src/shared/application/send-bitrix-notificatio.service.ts`, `api/src/shared/data/contracts/send-notification.ts`
- Test: `api/src/shared/application/send-bitrix-notificatio.service.test.ts`

**Interfaces — Produces:**

```ts
export type PublishedComment = { commentId: string; asAuthor: boolean }
export interface TimelineCommentPublisher {
  publish(input: SendNotificationInput): Promise<PublishedComment | null>
  /** `false` = o comentário não existe mais. Falha temporária lança. */
  update(input: SendNotificationInput & PublishedComment): Promise<boolean>
}
```

`BitrixLivefeedNotificationService` implementa as duas; `execute` passa a chamar `publish` e ignorar o retorno. `commentId` vem de `result`. `update` usa `crm.timeline.comment.update` com `{ id, fields: { COMMENT } }`, mantendo o ícone; com `asAuthor`, usa o token do autor e, se recusado (`isAuthorRefusal`) ou indisponível, a instalação com a `senderLine`. Resposta `NOT_FOUND` devolve `false`.

- [ ] **Step 1: Testes que falham:** `publish` devolve `{ commentId: '77', asAuthor: true }` com `result: 77`; devolve `null` em erro de rede (sem segunda chamada); `update` recusado como autor repete pela instalação; `update` com `NOT_FOUND` devolve `false`; erro de rede no `update` rejeita.
- [ ] **Step 2:** `yarn test src/shared/application/send-bitrix-notificatio.service.test.ts` — FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** PASS, com os testes antigos intactos.
- [ ] **Step 5:** Commit "Permite editar o comentário de timeline publicado".

### Task 5: Fila de avisos e registro do desfecho

**Files:**
- Create: `api/src/queue/thinkzap-send-notices.queue.ts`, `api/src/modules/thinkzap/application/publish-send-state.ts`
- Modify: `api/src/queue/bull-board.ts`
- Test: um `.test.ts` ao lado de cada

**Interfaces — Produces:**

```ts
export const THINKZAP_SEND_NOTICES = 'thinkzap-send-notices'
export type SendNoticeJob = { kind: 'comment' | 'alert'; noticeId: string }
export const SEND_NOTICE_WINDOW_MS = { comment: 15_000, alert: 120_000 } as const
export function sendNoticeSchedule(job: SendNoticeJob, now: number): { jobId: string; delay: number }
export function enqueueSendNotice(job: SendNoticeJob): Promise<void>

export type PublishSendStateDeps = {
  outbox: Pick<PrismaWidgetOutboxRepository, 'findById' | 'linkSendNotice'>
  notices: Pick<PrismaSendNoticeRepository, 'ensure'>
  enqueue: (job: SendNoticeJob) => Promise<void>
}
/** Relê a row, garante o aviso e agenda comentário e alerta. Nunca lança. */
export function publishSendState(outboxId: string, deps: PublishSendStateDeps): Promise<void>
```

`bucket = floor(now / janela)`; `jobId = send-notice-{kind}-{noticeId}-{bucket}` (sem `:`); `delay = (bucket + 1) * janela - now`. Assim um evento que chega durante a execução cai na janela seguinte e não se perde. Job com `attempts: 5`, backoff exponencial de 5 s, `removeOnComplete: true`, `bullBaseOptions` (prefixo). `dispatchKey = dispatchGroupId ?? row.id`; row com `sendNoticeId` não chama `ensure`. `comment` é sempre agendado; `alert` só quando a row está `FAILED`, `UNKNOWN` ou recusada. Row fora do escopo: não faz nada. Dados do aviso de grupo de robô (entidade) vêm de `row.entity`/`row.entityId`, e o operador de `row.operatorBitrixUserId`.

- [ ] **Step 1: Testes que falham:** dois horários na mesma janela geram o mesmo `jobId` e o `delay` leva ao fim dela; janela seguinte gera outro; `SENT` sem recusa agenda só `comment`; `FAILED` agenda os dois; campanha de SMS não chama nada; `enqueue` rejeitando faz `publishSendState` resolver (Redis fora).
- [ ] **Step 2:** `yarn test publish-send-state thinkzap-send-notices` — FAIL.
- [ ] **Step 3:** Implementar e registrar a fila no Bull Board.
- [ ] **Step 4:** PASS e `yarn test src/queue` (guard de prefixo).
- [ ] **Step 5:** Commit "Cria a fila de avisos de envio".

### Task 6: Job do comentário

**Files:**
- Create: `api/src/modules/thinkzap/application/refresh-send-comment.ts` + teste

**Interfaces — Consumes:** Tasks 1 a 5.

```ts
export type RefreshSendCommentDeps = {
  notices: Pick<PrismaSendNoticeRepository, 'findById' | 'claimComment' | 'saveComment' | 'saveFromPhone'>
  outbox: Pick<PrismaWidgetOutboxRepository, 'findBySendNotice'>
  publisher: (notice: SendNoticeRecord) => Promise<TimelineCommentPublisher | null>
  locale: (notice: SendNoticeRecord) => Promise<NoticeLocale>
  fromPhone: (row: WidgetOutboxRecord) => Promise<string>
  now: () => Date
}
export function refreshSendComment(noticeId: string, deps: RefreshSendCommentDeps): Promise<void>
```

Regras: sem aviso, sem rows ou sem entidade → retorna. Sem `commentId` e (não `eager` e não `isSettled`) → retorna. Sem `commentId`: `claimComment`; perdeu → lança (o job retenta; a próxima execução já edita); venceu → `publish`; `null` → log e retorna, sem retentar. Com `commentId`: `update`; `false` → log e retorna; exceção sobe. Aviso reivindicado que nunca ganhou `commentId` (publicação que falhou) esgota as tentativas do job e fica sem comentário, de propósito.

Montagem: `kind` pela row (`TEMPLATE`, `INTERACTIVE_BUTTON`, senão `message`); `automation` por `isAutomationOrigin`. Texto: `dispatchMeta.message` do `partIndex 0` quando houver, senão `row.text`. Arquivos do robô como em `settle-robot-message-group.ts` (`meta.failedFiles` + partes `MEDIA`). `fromPhone`: o do aviso, o de `meta.fromPhone`, ou `deps.fromPhone` (gravado quando não vazio; erro vira `''`). `describeFailure`: recusada → `describeHubMessageDeliveryFailure({ external_information: { errors: [{ code, message: failureReason }] } }, locale)`; `lastError === DAILY_LIMIT_FAILURE` → texto de `dailyLimitNotices`; `MEDIA_EXPIRED_FAILURE` → razão `unavailable` dos arquivos; senão `lastError` cortado em 300 caracteres.

- [ ] **Step 1: Testes que falham:** aviso preguiçoso com parte pendente não publica; `eager` pendente publica com "Aguardando envio"; segunda execução chama `update` e não `publish`; `claimComment` falso rejeita sem publicar; `publish` nulo resolve sem `saveComment`; recusa `131047` mostra a frase traduzida.
- [ ] **Step 2:** `yarn test refresh-send-comment` — FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit "Publica e atualiza o comentário de status do envio".

### Task 7: Job da notificação

**Files:**
- Create: `api/src/modules/thinkzap/application/notify-send-failures.ts`, `.../application/helpers/crm-record-reference.ts` + testes

**Interfaces — Produces:**

```ts
/** lead=1, deal=2, contact=3, company=4, dynamic_<n>=n; sem diferenciar maiúsculas. */
export function crmRecordReference(entity: string, entityId: string): { entityTypeId: number; url: string } | null
export type NotifySendFailuresDeps = {
  notices: Pick<PrismaSendNoticeRepository, 'findById' | 'saveAlerted'>
  outbox: Pick<PrismaWidgetOutboxRepository, 'findBySendNotice'>
  bitrix: (notice: SendNoticeRecord) => Promise<Pick<BitrixClient, 'callMethod'> | null>
  locale: (notice: SendNoticeRecord) => Promise<NoticeLocale>
}
export function notifySendFailures(noticeId: string, deps: NotifySendFailuresDeps): Promise<void>
```

URL: `/crm/{lead|deal|contact|company}/details/{id}/`; SPA: `/crm/type/{n}/details/{id}/`. Só notifica quando `failureCount > alertedFailures`. Destinatário: `operatorBitrixUserId`; senão `assignedById` de `crm.item.get` (`entityTypeId`, `id`); sem ninguém, retorna. Envio por `BitrixSystemNotificationService.notify` com `tag: thinkzap-send-{noticeId}`; `saveAlerted` só quando devolver `true`; `false` lança para o job retentar.

- [ ] **Step 1: Testes que falham:** `crmRecordReference('DYNAMIC_128', '9')` → `{ entityTypeId: 128, url: '/crm/type/128/details/9/' }`; contagem igual à já avisada não notifica (recusa repetida); sem operador usa o responsável; 3 falhas geram uma chamada com a tag; `notify` falso não grava.
- [ ] **Step 2:** `yarn test notify-send-failures crm-record-reference` — FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit "Notifica quem enviou sobre falhas de envio".

### Task 8: Ligar nos workers

**Files:**
- Create: `api/src/workers/thinkzap-send-notices.processor.ts`, `api/src/modules/thinkzap/main/make-send-notice-deps.ts`
- Modify: `api/src/workers/thinkzap-widget-outbound.worker.ts` (segundo `Worker`, concorrência 3, no mesmo processo; sem mudar compose), `api/src/workers/thinkzap-widget-send.processor.ts`
- Test: `api/src/workers/thinkzap-widget-send.processor.notices.test.ts`

**Interfaces — Produces:** `processSendNoticeJob(job: SendNoticeJob): Promise<void>`; `makePublishSendState(): (outboxId: string) => Promise<void>`; `shouldPublishSendState(status: DispatchOutcome['status']): boolean` (`sent`, `resumed`, `failed`, `unknown`, `skipped`; não `locked` nem `deferred`).

Mudanças no processor de envio:
- depois de `dispatch.execute`, se `shouldPublishSendState`, chamar `publishSendState(row.id)`; o mesmo em `settleUnresolvedLine`, depois de `markFailed`;
- para `isTrackedSend`, `notifyOutcomeFor`, `notifySentFor` e os `postTimeline` de `settleGroup` não comentam mais (as aberturas de conversa seguem);
- rows fora do escopo mantêm os caminhos atuais;
- `fromPhone`: Z-API por `getPhoneData`; oficial por `hubMessageConnectorLabel` da instância.

- [ ] **Step 1: Testes que falham:** `shouldPublishSendState` por status; para row `WIDGET`, `notifySentFor` não chama o publicador; para campanha de SMS, chama como antes.
- [ ] **Step 2:** `yarn test src/workers` — FAIL nos novos.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `yarn test src/workers src/modules/thinkzap` — PASS.
- [ ] **Step 5:** Commit "Publica o status dos envios pelo worker".

### Task 9: Robôs de template e de botões

**Files:**
- Modify: `presentation/controllers/bitrix-template-robot-webhook-handler.controller.ts`, `bitrix-button-robot-webhook-handler.controller.ts` (e as subclasses official/unofficial), `application/enqueue-template-send.service.ts`, `application/enqueue-interactive-button-send.service.ts`, factories `main/make-bitrix-*-robot-*.ts`, `domain/notices/timeline-notices.ts` (remover `queued` e os títulos que ficarem sem uso)
- Test: os `.test.ts` dos dois controllers

**Interfaces — Produces:** `sendNoticeId?: string` nos inputs de `enqueue` dos dois serviços, repassado a `outbox.create`. Os controllers recebem:

```ts
type OpenSendNotice = (input: { entity: string; entityId: string; domainId: string; appCode: string; operatorBitrixUserId: string | null }) => Promise<{ id: string; refresh: () => Promise<void> } | null>
```

`open` chama `ensure` com `eager: true` e `dispatchKey` aleatório; devolve `null` fora do CRM ou se falhar (o envio segue, e `publishSendState` cria o aviso depois). `refresh` agenda o job `comment` uma vez, após o laço, se houver enfileirados. As recusas do robô continuam comentando como hoje. `appCode` é o mesmo `scope.appCode`.

- [ ] **Step 1: Testes que falham:** disparo com 2 destinos abre um aviso, os dois `enqueue` recebem o mesmo `sendNoticeId`, `refresh` uma vez e **nenhum** comentário "enfileirado"; `open` rejeitando não impede o envio; recusa do robô continua comentando.
- [ ] **Step 2:** `yarn test robot-webhook-handler` — FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit "Unifica o comentário dos robôs de template e botões".

### Task 10: Registrar a recusa da linha oficial

**Files:**
- Create: `application/record-delivery-rejection.ts` + teste
- Modify: `application/process-hubmessage-delivery-status.use-case.ts` (+ teste), `workers/hubmessage-status.processor.ts`, `queue/thinkzap-inbound.queue.ts` (`recordOnlyAttempt?: number` no job `hubmessage-status`), `workers/thinkzap-inbound.worker.ts`

**Interfaces — Produces:**

```ts
export const REJECTION_RETRY_DELAYS_MS = [10_000, 30_000, 60_000, 120_000, 300_000] as const
export type RejectionResult = 'recorded' | 'duplicate' | 'untracked' | 'row-missing'
export function recordDeliveryRejection(
  input: { instanceId: string; providerMessageId: string; stateItem: HubMessageStateItem | undefined },
  deps: { outbox: Pick<PrismaWidgetOutboxRepository, 'findByProviderMessageId' | 'markRejected'>; publish: (outboxId: string) => Promise<void>; now: () => Date },
): Promise<RejectionResult>
```

`code = readMetaErrorCode(stateItem) ?? null`; `reason = buildFailureText(stateItem)`, cortado em 2000. `publish` só em `recorded`. O use case chama o registro (dep opcional) para estado de falha, logo após achar a instância e antes dos demais caminhos; `execute` ganha `context.recordOnlyAttempt?: number`. Em `row-missing`, dep opcional `retryRecording(envelope, nextAttempt)` enfileira com `delay = REJECTION_RETRY_DELAYS_MS[attempt]` e `jobId: hubmessage-status-retry-{providerMessageId}-{nextAttempt}`; esgotado, log e fim, sem lançar. Execução com `recordOnlyAttempt` definido **só** registra: não avisa no chat nem reporta campanha. Erro do registro é capturado e não afeta o aviso ao chat.

- [ ] **Step 1: Testes que falham:** recusa grava código e publica; segunda entrega devolve `duplicate` sem publicar; estado sem erro não grava; row ausente agenda tentativa 1; tentativa 5 não agenda; execução `recordOnly` não chama `notifyOperator` nem `reportSmsStatus`; testes de SMS existentes seguem passando.
- [ ] **Step 2:** `yarn test record-delivery-rejection process-hubmessage sms-delivery-status` — FAIL nos novos.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit "Registra a recusa da Meta no envio".

### Task 11: Retenção de 90 dias

**Files:**
- Modify: `api/src/config/env.ts`, `api/.env.example`, repositório do outbox, `shared/infra/scheduler/failure-retention.job.ts`, `api/src/scripts/prune-widget-outbox.ts`, `DEPLOY.md`
- Test: `failure-retention.job.test.ts` e testes do repositório

**Interfaces — Produces:** `parseSendHistoryDays(raw: string | undefined): number` (padrão 90, mensagem de erro no padrão de `parseFailureRetentionDays`); `env.thinkzapSendHistoryDays`; `RetentionTarget.retentionDays?: number` (substitui o padrão do job para aquele alvo); `deleteExpiredSendHistoryBatch(cutoff, limit)`.

`deleteExpiredFailuresBatch` passa a **excluir** as rows rastreadas (`origin` em `TRACKED_SEND_ORIGINS` e `smsMessageId` nulo). `deleteExpiredSendHistoryBatch` apaga só as rastreadas em `SENT`, `FAILED` ou `UNKNOWN`, com `createdAt` e `updatedAt` antes do corte. Alvos novos no job, ambos com o prazo de histórico: histórico de envios e avisos. `deleteSentOlderThan` passa a poupar as rastreadas (o job novo cuida delas). Com `FAILURE_PURGE_ENABLED` desligado nada é apagado, como hoje. `DEPLOY.md`: nova env e a regra de menor prazo em banco compartilhado.

- [ ] **Step 1: Testes que falham:** parse (vazio → 90, `'0'` lança); alvo com `retentionDays: 90` recebe corte de 90 dias e os demais de 7; filtros dos três métodos.
- [ ] **Step 2:** `yarn test failure-retention prisma-widget-outbox` — FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit "Guarda o histórico de envios por 90 dias".

### Task 12: Verificação final

- [ ] `cd api && yarn check-types && yarn lint && yarn test` — sem erros nem warnings (falha preexistente é anotada no commit).
- [ ] Criar `openspec/changes/status-entrega-envios-thinkzap/tasks.md` com o que falta em staging: migration aplicada; `worker:widget-outbound` consumindo a fila nova; envio pelo widget e por cada robô; recusa real na linha oficial; notificação; `hubmessage:sync-channel-webhook-events` conferido; cron do `prune-widget-outbox`.
- [ ] Commit "Registra as validações pendentes da etapa 1".
