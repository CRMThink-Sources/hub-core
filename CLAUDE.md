# CLAUDE.md — hub-core (HubThink Core)

## Visão geral

Monorepo da plataforma HubThink (CRMThink): apps que se instalam no Bitrix24 e
integram canais de mensagem (ThinkZap via Z-API e HubMessage/WhatsApp Oficial),
além de ThinkAnalise, ImportSheet, ClickSign e GPT Maker. Cobrança e planos vivem
em SPAs do próprio Bitrix (CRM) e no Stripe. Inclui um portal admin (backoffice)
e um servidor MCP de base de conhecimento do suporte.

## Stack

- Gerenciador de pacotes: **yarn** (`yarn.lock` em cada pacote; CI usa `yarn install --frozen-lockfile`). Node 20.
- `api/`: TypeScript 5.9, Express 4, Prisma 7 (MariaDB/MySQL via `@prisma/adapter-mariadb`), BullMQ + Redis (ioredis), Socket.IO, Stripe, Zod 4, Vitest 4, tsx.
- `front/`: Next.js 16 (App Router), React 19, Tailwind 4, shadcn/base-ui, i18n próprio (`front/i18n`, `front/messages`), Vitest.
- `mcp/`: Node ESM, `@modelcontextprotocol/sdk`, Express, JWT, Zod 3. Serve markdown de `mcp/kb/`.
- Infra: Docker (imagem por pacote no GHCR), `docker-compose*.yml`, Grafana/Loki em `observability/`.
- Não há `package.json` na raiz: rode comandos dentro de cada pacote.

## Comandos essenciais

API (`cd api`):
- Dev: `yarn dev` (tsx watch, `src/index.ts`) — precisa de `api/.env` (modelo: `api/.env.example`)
- Workers (processos separados, cada um com seu script): `yarn worker:thinkzap`, `worker:widget-outbound`, `worker:spa-provisioning`, `worker:spa-resource-sync`, `worker:importsheet`, `worker:clicksign` (lista completa em `api/package.json`)
- Testes: `yarn test` (vitest run) · um arquivo: `yarn test src/caminho/arquivo.test.ts` · um teste: `yarn test -t "nome do teste"` · watch: `yarn test:watch`
- Lint: `yarn lint` (roda `prisma generate` antes; `--max-warnings 0`)
- Tipos: `yarn check-types`
- Build: `yarn build` (`tsc && tsc-alias`)
- Prisma client: `yarn prisma:generate`
- Migration em produção/staging: `npx prisma migrate deploy` (feito pelo CI no deploy). Para criar nova: `npx prisma migrate dev --name <nome>` dentro de `api/`.

Front (`cd front`): `yarn dev` (porta **3001**, rewrite de `/api/*` para a API só em dev), `yarn build`, `yarn lint`, `yarn check-types`, `yarn test`.

MCP (`cd mcp`): `PORT=3200 yarn dev`, `yarn build`, `yarn lint` (faz `--fix`), `yarn check-types`. Não tem testes.

## Arquitetura

### API (`api/src`)
- `index.ts` sobe HTTP + Socket.IO; `app.ts` monta middlewares e rotas (`/api/thinkzap`, `/api/portal`, `/api/auth`, `/api/application`, etc.); `composition-root.ts` instancia as rotas de cada módulo.
- `modules/<modulo>/`: `thinkzap`, `application` (billing/instalação), `portal` (backoffice), `product-updates`, `importsheet`, `clicksign`, `gptmaker`, `thinkanalise`, `mcp-oauth`, `audio`, `auth`.
- Camadas dentro do módulo (visto em `thinkzap`): `domain/` (entities, errors, ports, repositories como interfaces, value-objects) → `application/` (casos de uso, ex.: `activate-line-subscription.ts`) → `infra/` (adapters, clients, gateway, persistence, queue, providers) → `presentation/` (controllers, mappers) → `main/` (factories/wiring) → `routes.ts`.
- `workers/`: processors e workers BullMQ (`*.processor.ts` = lógica; `*.worker.ts` = entrypoint). `queue/`: definição das filas. `config/env.ts`: toda leitura de env fica aqui.
- `shared/`: infra comum (logger, socket, Bitrix limits, Loki), `scripts/`: backfills e checks operacionais (`yarn backfill:*`, `yarn check:*`).
- Fluxo típico (mensagem recebida): webhook Bitrix/HubMessage → controller → fila BullMQ → worker/processor → caso de uso → repositório Prisma / client Bitrix → Socket.IO/Bitrix.
- Prisma: schema em `api/prisma/schema.prisma`; client gerado em `api/prisma/generated` (alias `@/prisma`).

### Front (`front/`)
- `app/` com route groups por produto: `(thinkzap)`, `(admin)`, `(clicksign)`, `(gptmaker)`, `(importsheet)`, `(thinkanalise)`, `(marketing)`, `(widgets)`, `(mobile)`. Widgets do Bitrix em `bitrix/` e `app/bitrix`.
- `components/`, `providers/`, `lib/`, `shared/`, `infra/` (clientes HTTP), `i18n/` + `messages/` (traduções), `middleware.ts` (detecta locale).

### MCP (`mcp/`)
- Base de conhecimento por arquivos: `mcp/kb/runbooks/<app>/<area>/<causa>.md` → o `errorCode` é derivado do caminho (`app.area.causa`). Ver `mcp/README.md`.

### Outros
- `openspec/`: specs (`specs/`) e changes (`changes/`) do fluxo spec-driven (skills `openspec-*` / `/opsx:*`).
- `observability/`, `docker-compose.*.yml`, `DEPLOY.md`, `docs/DEV-BITRIX.md` (dev local com Bitrix cloud via túnel cloudflared).

## Convenções de código

- Prettier: sem ponto e vírgula, aspas simples, `trailingComma: all`, `printWidth: 80`, `arrowParens: avoid`. `.editorconfig`: 2 espaços, **CRLF**.
- Arquivos em kebab-case com sufixo de papel: `*.processor.ts`, `*.worker.ts`, `*.queue.ts`, `*.error.ts`, `*.repository.ts`, `*.test.ts` ao lado do código.
- Imports na API usam alias `@/` (= `src/`); em `composition-root.ts`/`index.ts` aparecem imports relativos com extensão `.js`.
- Erros de domínio: classe que estende `Error` em `domain/errors/*.error.ts`, com `name` definido e mensagem em pt-BR dizendo o que está errado e como consertar; comentário JSDoc explica o porquê.
- Casos de uso recebem dependências por parâmetro (ports/repositórios como interfaces) — sem importar infra diretamente.
- Testes: Vitest (`describe/it/expect/vi`), mocks tipados pelo contrato (`vi.fn<Repo['metodo']>`), não `vi.fn()` cru. Front: só `.test.ts` (ambiente node) em `app`, `shared`, `bitrix`, `providers`, `lib`, `components`.
- Comentários e mensagens de commit em **português**; comentários explicam o porquê (decisões, incidentes), não o quê. Preserve-os ao editar.
- tsconfig da API: `strict` + `noUncheckedIndexedAccess`.

## Regras importantes

- **Nunca** commitar `.env`/segredos; novas variáveis entram em `api/.env.example` (com comentário) e em `config/env.ts`.
- **Nunca** editar migrations já existentes em `api/prisma/migrations`; crie uma nova.
- **Nunca** editar `api/prisma/generated` (gerado) nem `tsconfig.tsbuildinfo`.
- Rode comandos dentro do pacote certo (`api`, `front` ou `mcp`); não há workspace na raiz.
- `QUEUE_PREFIX`: ambientes que dividem Redis/DB sem prefixo próprio dividem a fila (worker de staging pode consumir mensagem de produção). Cache e locks não têm prefixo — use índices de DB distintos no `REDIS_URL`.
- Homologação e produção usam o **mesmo portal Bitrix** (mesma SPA de planos). Flags como `CRMTHINK_TASKS_SYNC_ENABLED`, `THINKZAP_SPA_PROVIDER_EFFECTS_ENABLED`, `SUBSCRIPTION_EXPIRATION_ENABLED`, `STRIPE_SYNC_ENABLED` devem ficar `false` em dev local: o CRM e os providers são os reais.
- Prefixo da chave Stripe (`sk_live_` vs outro) define o ambiente do gateway; sem fallback entre campos de price id de produção/homologação.
- Sem worker rodando, jobs ficam parados na fila (ex.: provisionamento de item criado na SPA exige `worker:spa-provisioning`).
- `NEXT_PUBLIC_*` do front são embutidas no build: trocar valor exige rebuild da imagem.
- Mudar a `kb/` do MCP exige redeploy do MCP.
- CI/CD: push em `master` → production (`:latest`); push em `develop` → staging (`:staging`). Deploy roda `prisma migrate deploy`. Lint/tipos quebrados bloqueiam o pipeline.
- Chamadas ao Bitrix passam por `shared/infra/bitrix-limits`: não contorne com requests diretos.
- `.gitignore` ignora `.claude/`, `docs/`, `tasks`, `.specs/` — não conte com esses arquivos no repositório.
- Valor de campo em robô de Bizproc: o Bitrix resolve a expressão **antes** de chamar o webhook, então o servidor só vê o resultado. Campo do documento vai em **chave simples** (`{=Document:ID}`); com chave dupla sobram chaves (`{João}`). O Bitrix devolve o campo ao reabrir em forma de exibição (`{{{Contato: Celular}}}`), que ele **não** resolve se for regravado: a tela do robô precisa reabrir isso como campo, não como texto. Campo vazio chega como `{}`; um telefone cadastrado como "Trabalho" não aparece em "Contato: Celular".

## Fluxo de trabalho com Git

- **Nunca** commitar direto em `develop` nem em `master`. Cada alteração tem a sua branch, criada a partir da `develop`, no padrão `task/<nome>` (ou `fix/<nome>`). Quando a alteração nasce de uma change do OpenSpec, use o nome da change: `task/<nome-da-change>`.
- O commit da alteração fica **nessa branch**. O PR para `develop` é aberto pelo usuário: **não** dar `git push` nem abrir PR, a menos que seja pedido. Dar push em `develop` publica em staging (ver CI/CD acima).
- Commite só os arquivos da alteração (`git add` explícito, nunca `git add -A`). O working tree costuma ter arquivos sem rastreio de outras frentes (ex.: outra change em `openspec/changes/`); eles ficam de fora.
- Mensagem de commit em português, no imperativo, com o porquê no corpo. Se houver tarefa pendente (validação em staging, arquivar a change), registre no corpo e em `tasks.md` da change.
- Antes do commit, rode as verificações do pacote alterado (seção abaixo). Falha preexistente em teste que a alteração não toca não bloqueia, mas deve ser dita no commit e no PR.
- Change do OpenSpec: `/opsx:propose` cria, `/opsx:apply` implementa (marque as tarefas no `tasks.md` só quando o comportamento especificado estiver completo) e `/opsx:archive` arquiva depois do deploy e da validação.

## Como verificar o trabalho

Antes de dar por pronto, no pacote alterado:
1. `yarn check-types`
2. `yarn lint` (API: zero warnings)
3. `yarn test` (API/front; ou o arquivo afetado)
4. Se mexeu no `schema.prisma`: criar migration e `yarn prisma:generate`.
5. Se mexeu em env: atualizar `api/.env.example` e `config/env.ts`.
6. Mudança que cruza pacotes (API ↔ front): validar os dois.

## Pontos a confirmar

1. `DEPLOY.md` cita branches `develop`/`main`, mas o CI usa `master`/`develop` — assumi `master`.
2. Existem `package-lock.json` e `yarn.lock` em `front/` — confirmar que o gerenciador oficial é yarn.
3. Não li o `ci.yml` por inteiro: confirmar se algum job roda `yarn test` (só vi lint e check-types nos jobs de API/front/MCP).
4. Convenção exata de migrations (nomes sem sufixo vs. `_descricao`) e se `migrate dev` é usado localmente.
5. Existe `.mcp.json` na raiz mas ignorado pelo git — confirmar se deve ser documentado.
6. Estrutura interna dos módulos além de `thinkzap` (ex.: `application`, `portal`) foi só inspecionada por listagem; podem diferir.
7. `.claude/worktrees/` contém cópias do repositório (ex.: `novidades-thinkzap-design`) — evitar buscar/editar nelas por engano.
