# Tasks

## 1. Dados e configuração

- [ ] 1.1 Adicionar o model `ProductUpdate` (D2) e os enums `ProductUpdateProgress`/`ProductUpdateVisibility` em `api/prisma/schema.prisma`, com índice único em `bitrix_task_id` e FKs para `PortalUser`, e gerar a migration em `api/prisma/migrations/<timestamp>_add_thinkzap_product_updates/`. Verificação: `yarn prisma migrate dev` aplica sem erro num banco local e `yarn prisma generate` atualiza o client.
- [x] 1.2 Adicionar `crmthinkTasks: { syncEnabled, groupId, webhookToken }` em `api/src/config/env.ts` (`CRMTHINK_TASKS_SYNC_ENABLED` padrão `false`, `CRMTHINK_TASKS_GROUP_ID` padrão `2677`, `CRMTHINK_TASKS_WEBHOOK_TOKEN`) e documentar em `api/.env.example`, incluindo os escopos `task` e `user` exigidos no `CRMTHINK_WEBHOOK_URL`. Verificação: `yarn tsc --noEmit` na API e teste de `env` (se existir) com os padrões.

## 2. Domínio: novidade e regras

- [x] 2.1 Criar `api/src/modules/product-updates/domain/` com:
  - a entidade e o schema zod de `content` (pt/en/es + `imageKey`, com trim);
  - as derivações de situação e de "alterações pendentes";
  - `missingLocales(content)`.

  Verificação: testes unitários das quatro situações, da comparação normalizada (espaço extra não conta como alteração) e dos idiomas faltantes.
- [x] 2.2 Implementar `applyTaskStatus(update, taskStatus)` (D3) como função pura. Verificação: testes para status 5 (conclui), 4 (só cache, nada muda), 2/3 com `availableAt` nulo (volta para `PENDING`), qualquer status com `availableAt` preenchido (mantém) e idempotência (aplicar duas vezes = uma).
- [x] 2.3 Criar o port `ProductUpdateRepository` e `PrismaProductUpdateRepository` (`findById`, `list`, `findByBitrixTaskId`, `listReconcilable`, `save`, `delete`). Mapear `P2002` em `bitrix_task_id` para `TaskAlreadyLinkedError`. Verificação: teste do repositório (padrão dos `prisma-*.repository` existentes), incluindo a violação de unicidade.

## 3. Casos de uso do backoffice (conteúdo e ciclo de vida)

- [x] 3.1 Implementar `CreateProductUpdate`, `UpdateProductUpdateContent`, `GetProductUpdate` e `ListProductUpdates`. A lista traz situação, pendências, tarefa e `availableAt`, com filtro por situação. Todos registram `portalUserId`. Verificação: testes unitários com repositório falso, incluindo "salvar numa publicada não muda `publishedContent`".
- [x] 3.2 Implementar as ações de publicação, cada uma com as recusas do spec (`422` com os idiomas faltantes, `409` de situação):
  - `PublishProductUpdate` (em breve);
  - `PublishProductUpdateAsAvailable` (exige `DONE`; mantém `availableAt` se já existir);
  - `PublishProductUpdateChanges`;
  - `DiscardProductUpdateChanges`;
  - `UnpublishProductUpdate`;
  - `DeleteProductUpdate` (só com `firstPublishedAt` nulo).

  Verificação: um teste por cenário do spec `novidades-backoffice` (republicar mantém a data, rascunho direto para disponível, excluir publicada → `409` etc.).
- [x] 3.3 Criar o port `ProductUpdateImageStorage`, o adapter `R2ProductUpdateImageStorage` (chave `product-updates/<uuid>.<ext>`), a factory `makeProductUpdateImageStorage` (`null` sem R2), o multer (PNG/JPEG, 5 MB) e os casos de uso de enviar e remover a imagem em `content`. Verificação: teste do adapter com `S3Client` falso (chave e content-type), teste do multer recusando GIF → `422` e sem R2 → `503`.

## 4. Integração com tarefas do Bitrix

- [x] 4.1 Criar o port `CrmthinkTasksGateway` e o adapter `BitrixCrmthinkTasksGateway` (D4: get, search, getTasks em lotes de 50, create, complete, renew, searchUsers), com erros mapeados para `CrmthinkTasksUnavailableError`. Verificação: testes com `BitrixClient` falso, conferindo método e parâmetros de cada chamada (filtro `GROUP_ID` e `%TITLE`, lote de IDs, `RESPONSIBLE_ID`).
- [x] 4.2 Implementar os casos de uso de busca de tarefas e de usuários:
  - `SearchCrmthinkTasks`: número busca por ID e marca `outsideGroup`; texto busca no grupo configurado;
  - `SearchCrmthinkUsers`.

  Verificação: testes de ID dentro e fora do grupo, de busca por texto e de falha → erro propagado.
- [x] 4.3 Implementar `LinkCrmthinkTask` (lê o status e aplica `applyTaskStatus`), `UnlinkCrmthinkTask` e `CreateCrmthinkTaskForUpdate` (responsável obrigatório, descrição em pt + link do backoffice, grupo configurado, recusa com sync desligado). Verificação: testes de vincular tarefa já concluída → `DONE`, tarefa já usada → `409` com a novidade, criação sem responsável → `422` e sync desligado → `409 tasks-sync-disabled`.
- [x] 4.4 Implementar `CompleteProductUpdate` e `ReopenProductUpdate` (D7). Sem tarefa, só mudam a novidade. Com tarefa, chamam `complete`/`renew` no Bitrix: `complete` relê o status e devolve `awaitingApproval` no status 4. Uma falha no Bitrix não grava nada. Desmarcar uma novidade disponível → `409`; uma despublicada limpa `availableAt`. Verificação: testes para status final 5, status final 4, falha do Bitrix, sem tarefa e sync desligado.

## 5. API do backoffice

- [x] 5.1 Criar controllers, factories e `createProductUpdatesPortalRoutes(portalAuthMiddleware)` com as rotas de lista, detalhe, criação, edição, imagem, publicar, publicar como disponível, publicar alterações, descartar, despublicar, excluir, concluir, desmarcar, buscar tarefas, buscar usuários, vincular, desvincular e criar tarefa. Montar em `/api/portal/novidades` em `app.ts`/`composition-root.ts` e mapear os erros de domínio (`404`, `409`, `422`, `502`, `503`). Verificação: testes de controller para o mapeamento de cada erro e um teste de `401` sem sessão.

## 6. Sincronização Bitrix → backoffice

- [x] 6.1 Criar o controller `POST /api/webhooks/crmthink-tasks`, que:
  - responde `503` sem token e `401` com token errado;
  - responde `200` para payload malformado, para tarefa não vinculada (sem chamar o Bitrix) e com sync desligado;
  - desvincula direto no `ONTASKDELETE`;
  - enfileira no `ONTASKUPDATE` vinculado.

  Montar em `app.ts`. Verificação: um teste por cenário do requisito "Eventos de tarefa", com o gateway falso conferindo zero chamadas nos casos ignorados.
- [x] 6.2 Criar `api/src/queue/crmthink-task-sync.queue.ts` (`jobId = task-<id>`, delay de 5 s, prefixo pelo guard existente) e o processor `crmthink-task-sync.processor.ts` (`getTask` + `applyTaskStatus` + atualização do cache). Registrar o `Worker` no processo `spa-item-resource-sync.worker.ts`. Verificação: teste da fila (dedup por `jobId`, coberto por `queue-prefix.guard.test.ts`) e teste do processor para concluída, reaberta e tarefa inexistente (desvincula).
- [x] 6.3 Criar `crmthink-tasks-reconcile.job.ts` (+ lock) no padrão de `stripe-sync.job.ts`: `15 * * * *`, novidades com tarefa e sem `availableAt` em lotes de 50, falha de lote isolada e tarefa ausente desvinculada. Iniciar em `app.ts` só com sync ligado. Verificação: testes do job com deps falsas (lote com erro não impede o próximo; flag desligada não agenda).

## 7. Leitura do cliente

- [x] 7.1 Implementar `ListPublishedProductUpdates(locale)` e o controller `GET /api/thinkzap/novidades` com o `authMiddleware` do ThinkZap. Ele:
  - lê só `publishedContent`;
  - usa `pt` com locale inválido;
  - devolve `soon`/`available` com a ordenação do D10;
  - devolve a URL da imagem;
  - não inclui dados de tarefa nem de autoria.

  Verificação: testes dos cenários do spec `novidades-cliente` (mistura de situações, espanhol, alteração pendente não vaza) e `401` sem auth.

## 8. Front: backoffice

- [x] 8.1 Criar `front/lib/portal-product-updates.ts` (tipos e chamadas `axiosPortal`) e as mensagens em `front/messages/{pt,en,es}/admin/product-updates.json`. Adicionar o item Novidades em `admin-nav.ts` (`navProductUpdates`, ícone `Megaphone`) com as chaves de nav. Verificação: `admin-messages-parity.test.ts` e `admin-nav.test.ts` atualizados e passando (sete itens), e `yarn tsc --noEmit` no front.
- [x] 8.2 Extrair o card de novidade do cliente para um componente compartilhado (`front/components/product-updates/product-update-card.tsx`), usado na pré-visualização do admin e na aba do ThinkZap. Verificação: teste de componente renderizando um card com imagem, um sem imagem e o selo "Em breve" sem data.
- [x] 8.3 Criar a lista `/admin/novidades`, no padrão das páginas do admin, com:
  - cabeçalho com total e botão "Nova novidade";
  - filtro por situação;
  - destaque para "Aguardando revisão";
  - indicador de alterações pendentes;
  - tarefa e status;
  - estados de carregamento, vazio e erro.

  Construir com a skill `design-taste-frontend`. Verificação: teste da função de filtro e checagem no navegador a 375px sem rolagem horizontal.
- [x] 8.4 Criar a edição `/admin/novidades/[id]` (e `nova`), com:
  - abas pt/en/es com indicador de incompleto;
  - upload, troca e remoção de imagem;
  - pré-visualização por idioma;
  - bloco "Tarefa no Bitrix" (busca com `combobox` e debounce, aviso de fora do projeto, vincular, desvincular, criar com busca de responsável, status em cache e aviso "aguardando aprovação no Bitrix");
  - ações conforme a situação, com confirmação nas que afetam o cliente e na exclusão;
  - mensagens para `tasks-sync-disabled`, `422` e `409`.

  Verificação: teste da função que decide as ações por situação e um roteiro manual no navegador cobrindo o ciclo completo.
- [x] 8.5 Revisar as telas novas do admin com a skill `web-design-guidelines` e corrigir o que ela apontar. Verificação: os itens apontados resolvidos ou justificados no PR.

## 9. Front: aba do ThinkZap

- [x] 9.1 Criar `front/app/(thinkzap)/thinkzap/novidades/page.tsx` com:
  - as abas "Já disponível" (padrão) e "Em breve (N)";
  - o card compartilhado;
  - recarregamento ao trocar de idioma (`hub_locale`);
  - estados de carregamento, vazio por aba e erro com "tentar de novo".

  Mensagens em `front/messages/{pt,en,es}/thinkzap/novidades/page.json`. Construir com `design-taste-frontend`, no estilo das páginas do ThinkZap. Verificação: teste de componente (abre em "Já disponível", "Em breve" sem datas, vazio) e checagem no iframe do Bitrix.
- [x] 9.2 Adicionar `{ href: '/thinkzap/novidades', label: 'novidades' }` em `thinkzap-aside-config.ts` e o rótulo em `front/messages/{pt,en,es}/thinkzap/aside.json`, sem filtro de permissão. Revisar a página com `web-design-guidelines`. Verificação: o item aparece no menu nos três idiomas e o teste de config do aside (se existir) passa.

## 10. Integração e implantação

- [x] 10.1 Rodar a suíte completa da API e do front (`yarn test`, `yarn tsc --noEmit`, lint) no branch. Verificação: tudo verde. (Resultado: API 453/4736, tsc e lint limpos; front 1249/1250, tsc e eslint limpos — a única falha é `bots/issue-text.test.ts`, pré-existente no master e sem relação com esta change.)
- [x] 10.2 Escrever um roteiro de implantação em `openspec/changes/novidades-thinkzap/implantacao.md`, com:
  - os escopos `task`/`user` do webhook de entrada;
  - o webhook de saída `ONTASKUPDATE`/`ONTASKDELETE` → `/api/webhooks/crmthink-tasks`;
  - as envs por ambiente (flag desligada em homologação);
  - a checagem de permissão do usuário do webhook no grupo 2677.

  Verificação: o arquivo existe e foi revisado pelo time.
- [ ] 10.3 Validar ponta a ponta em produção, com a flag ligada:
  - vincular uma tarefa de teste;
  - concluir no Bitrix → "Aguardando revisão";
  - publicar como disponível → aparece no ThinkZap;
  - criar tarefa pelo backoffice;
  - concluir pelo backoffice → tarefa concluída no Bitrix;
  - testar uma tarefa com aprovação → "aguardando aprovação";
  - reabrir.

  Verificação: checklist preenchido no PR.

## 11. Vínculo do usuário do backoffice com o usuário do Bitrix

- [x] 11.1 API: adicionar `bitrixUserId Int? @map("bitrix_user_id")` ao `PortalUser` com a migration, aceitar `bitrixUserId` opcional no cadastro, devolvê-lo na listagem e criar `UpdatePortalUserBitrixId` com `PATCH /api/portal/users/:id` (`404` para usuário inexistente, `400` para valor inválido). Verificação: testes unitários do cadastro (com e sem ID, ID inválido), da listagem e da edição (definir, trocar, remover, inexistente), mais o teste de rota com `401` sem sessão; `yarn test`, `tsc` e eslint verdes na API.
- [x] 11.2 Front: campo "ID no Bitrix" no formulário de cadastro, coluna na tabela de usuários e edição do ID por linha (definir, salvar, remover), com mensagens em `messages/{pt,en,es}/admin/usuarios.json`. Verificação: teste da função que valida e normaliza o ID digitado, teste de paridade das mensagens, `vitest`, `tsc` e eslint verdes no front.
