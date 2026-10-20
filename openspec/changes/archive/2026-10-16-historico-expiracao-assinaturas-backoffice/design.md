# Design

## Context

- A varredura existe: `ExpireSubscriptions` (`modules/application/application/expire-subscriptions.ts`) devolve `ExpireSubscriptionsSummary { checked, trialExpired, pastDue, failed, paused }`. Ela é chamada por `startSubscriptionExpirationJob` (`shared/infra/scheduler/subscription-expiration.job.ts`) dentro de um lock no Redis (`subscription-expiration:tick`, 55 min) e o resumo é descartado. O detalhe de cada assinatura só vai para o log.
- O backoffice é o `/admin` do `front` (Next.js App Router, shadcn/base-ui, axios via `axiosPortal`, i18n em `front/messages/<lang>/admin/*.json`). A API dele fica em `/api/portal`, atrás de `portalAuthMiddleware`, que preenche `req.portalUserId`. Os papéis não são verificados (só existe `ADMIN`).
- O padrão a copiar é "listar usuários do portal": `routes.ts` → `main/factories/create-*-controller.ts` → `presentation/controllers/*` (zod e `this.ok`) → `application/*` → repositório Prisma. No front: `app/(admin)/admin/usuarios/page.tsx` com `AdminAuthGuard` e `AdminShell` e o corpo em `components/layouts/admin/admin-users-page.tsx`.
- Prisma: modelos em PascalCase, campos `@map("snake_case")`, tabelas `@@map("core_...")`, migrations `YYYYMMDDHHMMSS_snake`.
- `CRMTHINK_WEBHOOK_URL` tem o domínio do portal interno e também o segredo do webhook. Ele nunca pode ir para o front.

## Goals / Non-Goals

**Goals:**
- Histórico durável de toda rodada, com o detalhe por assinatura.
- Consultar e disparar pelo backoffice sem ferir as garantias do job: lock único e homolog sem gravar.

**Non-Goals:**
- Desfazer uma alteração pela tela. A reversão continua manual no CRM.
- Ver outros jobs (credential refresh, filas BullMQ). O Bull Board continua sendo o lugar das filas, e a rota `/admin/jobs` fica pronta para receber outros jobs depois.
- Autorização por papel: segue o resto do portal.
- Atualização em tempo real. A tela recarrega ao abrir, num botão "Atualizar" e, depois de "Rodar agora", a cada poucos segundos enquanto a rodada estiver `running`.

## Decisions

1. **Duas tabelas.**
   - `SubscriptionExpirationRun` (`core_subscription_expiration_runs`):
     - `id` uuid;
     - `trigger` (enum `SubscriptionExpirationTrigger`: `SCHEDULED | MANUAL`);
     - `triggeredByPortalUserId?`, com FK para `PortalUser` e `onDelete: SetNull`;
     - `status` (enum `SubscriptionExpirationRunStatus`: `RUNNING | SUCCESS | FAILED`);
     - `startedAt`, `finishedAt?`;
     - `checked`, `trialExpired`, `pastDue`, `failed` (int, default 0);
     - `paused` (bool), `error?`;
     - índice em `startedAt desc`.
   - `SubscriptionExpirationChange` (`core_subscription_expiration_changes`):
     - `id`, `runId` com FK e `onDelete: Cascade`;
     - `subscriptionId` (string, id da SPA);
     - `fromStatus`, `toStatus` (string, com os valores do domínio);
     - `periodEnd` (DateTime);
     - `succeeded` (bool), `error?`;
     - índice em `runId`.

   Os status ficam em string, não em enum do Prisma, porque já são valores do domínio da SPA e um status novo não deve exigir migration. O "abandonado" não é gravado: é derivado na leitura (`RUNNING` com `startedAt` há mais de 1h), porque o processo que morreu não tem como gravá-lo.

2. **`ExpireSubscriptions` passa a devolver `changes`.** O resumo ganha `changes: Array<{ subscriptionId, from, to, periodEnd, succeeded, error? }>`, preenchido no mesmo laço onde já incrementa os contadores. É uma mudança aditiva: os testes atuais continuam valendo, mas os que comparam o resumo inteiro com `toEqual` precisam do campo novo.

3. **Serviço `RunSubscriptionExpiration` (`modules/application/application/run-subscription-expiration.ts`) com a porta `SubscriptionExpirationRunRepository`.** O fluxo é:
   1. `start({ trigger, portalUserId })` cria a rodada `RUNNING` e devolve o id;
   2. roda `ExpireSubscriptions.execute()`;
   3. `finish(id, summary)` grava os contadores, as changes (`createMany`) e `SUCCESS`, numa transação;
   4. se der erro, `fail(id, message)` e o erro sobe de novo para o job registrar no log.

   Se a gravação do histórico falhar, isso não desfaz o que já foi gravado no Bitrix: o erro do histórico é só registrado em log.

4. **O lock vira um módulo reaproveitável.** `withExpirationLock` sai do arquivo do job para `shared/infra/scheduler/subscription-expiration.lock.ts`. A rodada agendada fica `lock → RunSubscriptionExpiration(SCHEDULED)`, então lock ocupado não registra nada, como diz a spec. O disparo manual usa um `tryStartManualRun(portalUserId)`:
   - pega o lock de forma síncrona (`SET NX`);
   - se não conseguir, devolve `{ status: 'busy' }`;
   - se conseguir, cria a rodada, devolve `{ status: 'started', runId }` e continua a execução em background (`void`), liberando o lock no `finally`.

   Assim o `POST` responde rápido (`202`) e nunca roda duas varreduras ao mesmo tempo.

5. **Disparo manual com a flag desligada responde `409`, e o código é `disabled`.** `env.payments.expiration.enabled` é verificado no caso de uso, antes do lock. A rota existe nos dois ambientes, então homolog consegue listar o histórico (que estará vazio) sem conseguir gravar.

6. **API (módulo `portal`).** As três rotas ficam atrás de `portalAuthMiddleware`:
   - `GET /subscription-expiration/runs?page&limit&trigger&onlyWithChanges`: `limit` até 100. `onlyWithChanges` filtra `trialExpired + pastDue + failed > 0 OR status <> SUCCESS`. A resposta é `{ runs, meta }`, como a de usuários, e cada rodada traz `abandoned: boolean`, `durationMs?` e o nome de quem disparou.
   - `GET /subscription-expiration/runs/:id`: rodada e `changes`. Cada change traz `crmUrl`, montado no servidor a partir da **origem** de `CRMTHINK_WEBHOOK_URL` (`https://<portal>/crm/type/1142/details/<id>/`). Só a origem é usada, para nunca vazar o caminho do webhook. Id desconhecido → `404`.
   - `POST /subscription-expiration/runs`: `202 { runId }`, `409 { code: 'busy' }` ou `409 { code: 'disabled' }`. O usuário vem de `req.portalUserId`.

7. **Front.**
   - `front/app/(admin)/admin/jobs/page.tsx`, com `AdminAuthGuard`, `AdminShell` e `AdminJobsPage`.
   - Componentes em `components/layouts/admin/`:
     - `admin-jobs-page.tsx`: aviso "a varredura não cancela", filtros, botão "Rodar agora" com `dialog.tsx` de confirmação e botão "Atualizar";
     - `admin-expiration-runs-table.tsx`;
     - `admin-expiration-run-detail.tsx`, um `sheet.tsx` lateral com as changes.
   - Tipos e chamadas em `front/lib/subscription-expiration-runs.ts`.
   - Rótulos de status ("Ativo", "Em teste", "Vencido", "Teste expirado") e textos em `messages/{pt,en,es}/admin/jobs.json`.
   - Item `navJobs` no `admin-shell.tsx`, com a chave em `admin/home`.
   - Toasts com `sonner` para `busy` e `disabled`.

8. **Limpeza de 90 dias no fim de cada rodada agendada.** `deleteMany` com `startedAt < now - 90d`, e o cascade apaga as changes. Rodar a cada hora é barato, porque o índice em `startedAt` atende.

## Risks / Trade-offs

- **Volume:** cerca de 720 rodadas por mês e cerca de 2.200 em 90 dias. É desprezível.
- **Rodada `RUNNING` órfã quando o processo morre.** → Ela aparece como "abandonada" depois de 1h. O lock expira em 55 min, então a rodada seguinte segue normalmente.
- **Disparo manual em background num processo que reinicia (deploy).** → A rodada fica abandonada, o mesmo caso acima. A próxima rodada agendada refaz o trabalho, porque a varredura é idempotente.
- **Qualquer usuário do portal pode disparar.** → É o mesmo nível de confiança das outras ações do admin (por exemplo, desassinar linha). O registro de quem disparou fica na rodada.
- **O link do CRM depende do formato da URL do Bitrix para SPA.** → Se `CRMTHINK_WEBHOOK_URL` estiver vazio, `crmUrl` é `null` e a tela mostra só o id.

## Migration Plan

1. Migration Prisma `YYYYMMDDHHMMSS_add_subscription_expiration_runs`, só aditiva.
2. Deploy da API e depois do front. Sem backfill: o histórico começa no deploy.
3. Rollback: reverter o código. As tabelas podem ficar no banco sem efeito.

## Open Questions

- Nenhuma.
