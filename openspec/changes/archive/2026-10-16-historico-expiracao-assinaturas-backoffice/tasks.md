# Tasks

## 1. Persistência

- [x] 1.1 Adicionar ao `api/prisma/schema.prisma` os enums `SubscriptionExpirationTrigger` e `SubscriptionExpirationRunStatus` e os modelos `SubscriptionExpirationRun` (`core_subscription_expiration_runs`, FK opcional para `PortalUser` com `SetNull`, índice em `startedAt`) e `SubscriptionExpirationChange` (`core_subscription_expiration_changes`, FK `Cascade` para a rodada, índice em `runId`). Criar a migration `api/prisma/migrations/<timestamp>_add_subscription_expiration_runs`. Verificar com `prisma validate` e `prisma generate` sem erro e com a migration só aditiva.
- [x] 1.2 Criar a porta `SubscriptionExpirationRunRepository` em `modules/application/domain/repositories` (`start`, `finish`, `fail`, `list`, `findById`, `deleteStartedBefore`) e a implementação Prisma em `modules/application/infra/prisma/repositories`, com `finish` gravando contadores e changes numa transação. Verificar com teste do repositório no padrão dos testes Prisma existentes: `finish` grava as changes, `list` pagina e filtra `onlyWithChanges` e trigger, `deleteStartedBefore` apaga em cascata.

## 2. Registro das rodadas

- [x] 2.1 Estender `ExpireSubscriptionsSummary` com `changes` (`subscriptionId`, `from`, `to`, `periodEnd`, `succeeded`, `error?`), preenchido no laço de `ExpireSubscriptions`. Verificar atualizando `expire-subscriptions.test.ts`: a alteração com sucesso e a falha aparecem em `changes` e a assinatura sem mudança não aparece.
- [x] 2.2 Criar `RunSubscriptionExpiration` (`modules/application/application/run-subscription-expiration.ts`), que faz start → execute → finish e, se der erro, fail e lança de novo. A falha ao gravar o histórico só vai para o log. Verificar com testes usando fakes: rodada vazia termina `SUCCESS` com zeros, erro do caso de uso termina `FAILED` com mensagem, e o trigger e o usuário são repassados.
- [x] 2.3 Extrair o lock para `shared/infra/scheduler/subscription-expiration.lock.ts` com `tryAcquire`/`release`, e fazer o job usar `RunSubscriptionExpiration` com `SCHEDULED` e a limpeza de 90 dias depois da rodada. Verificar com `subscription-expiration.job.test.ts` atualizado: com o lock ocupado não registra, com o lock livre registra uma rodada `SCHEDULED` e chama a limpeza com `now - 90d`.
- [x] 2.4 Criar `tryStartManualRun(portalUserId)`: devolve `disabled` quando `env.payments.expiration.enabled` é falso e `busy` quando o lock está ocupado; senão cria a rodada `MANUAL`, devolve `{ started, runId }`, continua em background e libera o lock no `finally`. Verificar com testes dos três caminhos e da liberação do lock depois de sucesso e de erro.
- [x] 2.5 Atualizar `makeExpireSubscriptions` (ou criar `makeRunSubscriptionExpiration`) para montar o serviço com o repositório Prisma. Verificar com `npx tsc --noEmit` em `api/`.

## 3. API do portal

- [x] 3.1 Criar `GET /api/portal/subscription-expiration/runs` (factory, controller com zod para `page`, `limit` ≤ 100, `trigger`, `onlyWithChanges`, e caso de uso), com `abandoned` (`RUNNING` há mais de 1h), `durationMs` e nome de quem disparou, atrás de `portalAuthMiddleware`. Verificar com teste do controller: validação, paginação e o cálculo de `abandoned`.
- [x] 3.2 Criar `GET /api/portal/subscription-expiration/runs/:id`, que devolve a rodada e as changes com `crmUrl` montado da **origem** de `CRMTHINK_WEBHOOK_URL` (`null` se vazio) e `404` para id desconhecido. Verificar com teste: o `crmUrl` não contém o caminho do webhook, e o `404`.
- [x] 3.3 Criar `POST /api/portal/subscription-expiration/runs`, que responde `202 { runId }`, `409 { code: 'busy' }` ou `409 { code: 'disabled' }`, usando `req.portalUserId`. Verificar com teste do controller nos três casos e com chamada sem token devolvendo `401`.

## 4. Front do backoffice

- [x] 4.1 Criar `front/lib/subscription-expiration-runs.ts` com tipos e chamadas via `axiosPortal` (listar, detalhar, disparar), tratando `409` por `code`. Verificar com `tsc` do front sem erro.
- [x] 4.2 Criar `messages/{pt,en,es}/admin/jobs.json` (títulos, filtros, rótulos de status "Ativo"/"Em teste"/"Vencido"/"Teste expirado"/"Cancelado", aviso de que a varredura não cancela, textos de confirmação e de `busy`/`disabled`) e a chave `navJobs` em `admin/home`. Verificar que as três línguas têm as mesmas chaves.
- [ ] 4.3 Criar `front/app/(admin)/admin/jobs/page.tsx` e `components/layouts/admin/admin-jobs-page.tsx`, com aviso, filtros, tabela paginada (`admin-expiration-runs-table.tsx`), botão "Atualizar" e destaque visual de `FAILED`, abandonada e falhas > 0. Adicionar `/admin/jobs` ao `navItems` do `admin-shell.tsx`. Verificar abrindo `/admin/jobs` logado e vendo a lista. Sem sessão, deve redirecionar para `/admin/login`.
- [ ] 4.4 Criar `admin-expiration-run-detail.tsx` (sheet lateral), que lista as changes com status "de → para" legível, fim do período, sucesso ou erro e link `crmUrl` em nova aba. Verificar abrindo uma rodada com alterações.
- [ ] 4.5 Adicionar o botão "Rodar agora" com diálogo de confirmação, toast para `busy`/`disabled` e atualização a cada poucos segundos enquanto a rodada criada estiver `RUNNING`. Verificar que cancelar a confirmação não chama a API e que confirmar mostra a nova rodada `MANUAL` passando de em andamento a concluída.

## 5. Integração

- [x] 5.1 Rodar `npm test` e `npx tsc --noEmit` em `api/` e o lint e o build do `front`. Verificar que tudo passa.
- [ ] 5.2 Validação local ponta a ponta com o banco e o Redis locais e a varredura apontada para um portal de teste, ou com `SUBSCRIPTION_EXPIRATION_ENABLED=false` para conferir o `409 disabled`: a rodada agendada aparece na lista, "Rodar agora" registra uma rodada `MANUAL`, e um segundo clique durante a execução mostra o aviso de `busy`.
