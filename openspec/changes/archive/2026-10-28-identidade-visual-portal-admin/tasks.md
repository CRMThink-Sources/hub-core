# Tasks

## 1. Tema do portal admin

- [x] 1.1 Aplicar `theme-thinkhub admin-theme` no wrapper de `front/app/(admin)/layout.tsx` e garantir que `Dialog`/`Sheet` (renderizados em portal) herdem os tokens. Verificar abrindo o diálogo "Rodar agora": o botão de confirmar deve estar no azul da marca.
- [x] 1.2 Reescrever `components/layouts/admin/admin-theme.css`:
  - remover os `--admin-*` órfãos;
  - declarar `--canvas` e os pares `--status-{success,warning,danger,info,neutral}`/`-foreground`;
  - expor esses tokens no `@theme inline`;
  - manter `.admin-card` e `.admin-login-bg` como aliases.

  Verificar com `npm run check-types` e `npm run lint` em `front/` e com as telas de Clientes e Falhas de envio renderizando sem regressão visual grosseira.

## 2. Componentes de página compartilhados

- [x] 2.1 Criar em `components/layouts/admin/ui/` os componentes `AdminPageHeader`, `AdminPanel`, `AdminEmptyState` e `AdminStatusBadge` (com `tone` + texto, D3). Verificar com `check-types`.
- [x] 2.2 Criar `AdminStatCard` com os estados pronto, `loading` (skeleton com a mesma altura) e `unavailable`. Verificar renderizando os três estados na home (grupo 5).
- [x] 2.3 Migrar `ExpirationRunStatusBadge` e `admin-outbox-status-badge.tsx` para `AdminStatusBadge`, sem cores Tailwind cruas. Verificar com `grep "bg-green-100\|bg-red-100" admin-expiration-runs-table.tsx admin-outbox-status-badge.tsx` vazio (as telas de Clientes, Instâncias e Usuários ainda têm cores cruas; são do redesenho delas) e testes existentes passando (`npm test`).

## 3. Shell e navegação

- [x] 3.1 Extrair os itens de navegação para um array tipado com `icon` e `group` (geral / Operação) e adicionar a chave i18n do grupo "Operação" em `messages/{pt,en,es}/admin/home.json`. Verificar com `check-types`.
- [x] 3.2 Reescrever `admin-shell.tsx` com sidebar `>= lg`, menu do usuário no pé da sidebar (`dropdown-menu`: nome + "Sair"; ver D2) e `aria-current="page"` no item ativo, mantendo a regra `exact`. Verificar manualmente:
  - em `/admin/jobs/expiracao-assinaturas`, só Jobs fica ativo;
  - "Sair" leva a `/admin/login`.
- [x] 3.3 Adicionar a navegação mobile (`< lg`) com `Sheet`, abrindo pelo botão de menu, fechando ao escolher um item, com `Esc` e ao tocar fora. Verificar em 375px que Jobs navega e fecha o menu.
- [x] 3.4 Adicionar teste unitário da regra de item ativo (função pura extraída do shell) cobrindo Início exato e sub-rotas. Verificar com `npm test`.

## 4. API: resumo do painel

- [x] 4.1 Adicionar `countAll()` a `PortalDomainReadRepository` e `PrismaPortalDomainReadRepository` (Prisma `count`). Verificar com teste do repositório ou do caso de uso com fake.
- [x] 4.2 Criar a porta `SubscriptionStatusCounter` em `application/domain/repositories` e `BitrixSubscriptionStatusCounter` (3 chamadas paralelas a `crm.item.list` por status com `select: ['id']`, lendo `total`). Verificar com teste unitário usando `BitrixClient` fake: os filtros por status estão certos e os totais são mapeados para `active`/`pastDue`/`trialing`.
- [x] 4.3 Criar `CachedSubscriptionStatusCounter` (Redis, TTL 60 s, guarda `generatedAt`, não cacheia falha). Verificar com teste: duas leituras seguidas chamam o contador interno uma vez.
- [x] 4.4 Criar o caso de uso `GetDashboardSummary` em `modules/portal/application`, devolvendo `subscriptions: null` com log `warn` quando a contagem falha. Verificar com testes dos cenários "resumo com sessão" e "Bitrix fora do ar" da spec `portal-admin/painel-inicial`.
- [x] 4.5 Criar controller e factory e registrar `GET /dashboard/summary` com `portalAuthMiddleware` em `modules/portal/routes.ts`. Verificar com teste do controller (200 com corpo) e com chamada sem token retornando `401`.

## 5. Home

- [x] 5.1 Criar `front/lib/portal-dashboard.ts` (`getDashboardSummary`) com o tipo da resposta. Verificar com teste no padrão de `subscription-expiration-runs.test.ts`.
- [x] 5.2 Reescrever `admin-home-content.tsx`:
  - cabeçalho com saudação e data;
  - os 4 `AdminStatCard` (Clientes com link para `/admin/clientes`);
  - estado indisponível quando `subscriptions` é `null`.

  Verificar manualmente com a API no ar e com a contagem forçada a falhar.
- [x] 5.3 Adicionar o painel "Saúde dos jobs" usando o registro de jobs (grupo 6) e o painel "Precisa de atenção" (falhas de envio via `listOutboxFailures` `limit: 1` + jobs em falha/atenção/atrasado, ou "tudo em dia"). Verificar manualmente com e sem falhas de envio.
- [x] 5.4 Atualizar `messages/{pt,en,es}/admin/home.json`: remover as chaves de "em breve" e adicionar as dos KPIs e painéis. Verificar que não sobra chave sem uso nem chave faltando nos três idiomas.

## 6. Jobs: catálogo e detalhe

- [x] 6.1 Criar `front/lib/admin-jobs.ts` com o registro (`expiracao-assinaturas`, intervalo 1h, `fetchLatestRun` sobre `listExpirationRuns({ page: 1, limit: 1 })`) e a função pura `deriveJobHealth`. Verificar com teste unitário cobrindo cada linha da tabela de precedência da spec `portal-admin/catalogo-jobs`.
- [x] 6.2 Reescrever `app/(admin)/admin/jobs/page.tsx` como catálogo: um card por job com nome, descrição, periodicidade, saúde, última rodada, e estado "indisponível" com "tentar de novo" por card. Verificar manualmente com a API de rodadas no ar e fora.
- [x] 6.3 Criar `app/(admin)/admin/jobs/[job]/page.tsx`, que resolve o job no registro e mostra "job não encontrado" com link para o catálogo para id desconhecido. Verificar abrindo `/admin/jobs/nao-existe`.
- [x] 6.4 Renomear `AdminJobsPage` para `AdminExpirationJobPage` e reestilizar com `AdminPageHeader` (breadcrumb Jobs → Varredura de expiração, saúde, ações "Atualizar"/"Rodar agora"), aviso, filtros, tabela e paginação, sem mudar a lógica de carregamento, polling e confirmação. Verificar manualmente o cenário "Ver o que venceu hoje" e o "Rodar agora" (ou o toast de desligado em homolog), e `npm test` passando.
- [x] 6.5 Atualizar `messages/{pt,en,es}/admin/jobs.json` com as chaves do catálogo, da saúde e do "não encontrado". Verificar nos três idiomas.

## 7. Verificação final

- [x] 7.1 Rodar `npm run lint`, `npm run check-types` e `npm test` em `front/` e a suíte da API. Todos devem passar.
- [x] 7.2 Percorrer em 1440px e em 375px a home, o catálogo, o detalhe do job, Clientes e Falhas de envio (as duas últimas só herdam o shell), com navegação por teclado no shell. Verificar a ausência de rolagem horizontal fora da tabela de rodadas.
- [x] 7.3 Rodar `openspec validate identidade-visual-portal-admin --strict` sem erros.
