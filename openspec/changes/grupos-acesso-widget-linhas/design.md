# Design

## Context

Ver `proposal.md` (Why). Estado atual observado:

- A **linha não é tabela Prisma**: é item da SPA do Bitrix, lido via
  `GetAplicationContext`; o id da linha é o `subscriptionItemId`.
- O widget (`front/app/(widgets)/layouts/conversation-view.tsx`) calcula as
  linhas no cliente com `listSendableLines(aplicationState.subscriptions, ...)`
  (`front/shared/aplication/subscription-items.ts`), a partir de
  `GET /api/application/me` (cacheado até ~5 min). O `<select>` começa vazio e
  nunca é travado.
- O JWT já carrega `bitrixUserId` e `isBitrixAdmin`
  (`api/src/middleware/auth.ts`). Os endpoints do widget ficam **antes** do
  `thinkzapAccessMiddleware` em `thinkzap/routes.ts` ("qualquer usuário Bitrix
  com JWT válido"), sem checagem por usuário ou por linha; a única
  autorização é por tenant (`findLineInContext`).
- Há padrão de CRUD admin a espelhar: `ThinkzapAllowedUser` /
  `ThinkzapAllowedDepartment` (domain → repositories por operação → Prisma →
  controllers → `main/make-*` → rotas com `requireThinkzapAdmin`), e a aba de
  administração em `front/app/(thinkzap)/thinkzap/administracao/page.tsx`.
- `GET /thinkzap/portal-users` lista usuários ativos do portal, mas fica atrás
  do `thinkzapAccessMiddleware` (usado só pelo admin, o que serve ao CRUD).

## Goals / Non-Goals

**Goals:**
- Regra única de "linhas permitidas ao usuário" em função pura de domínio,
  usada pela rota de leitura e pelo gate de envio.
- Restrição imposta no servidor, não só escondida no front.
- Sem grupos = comportamento idêntico ao atual (zero regressão).

**Non-Goals:**
- Permissões por departamento do Bitrix (só usuários nesta change).
- Restringir robôs Bizproc, SMS, campanhas e envios automáticos.
- Permissões de leitura da conversa/histórico por linha (apenas envio e seleção).
- Alterar o modelo de permissões `connectors/finance/thinkbot`.

## Decisions

1. **Três tabelas novas** `thinkzap_access_groups` (`appId`, `name`),
   `thinkzap_access_group_members` (`groupId`, `bitrixUserId`) e
   `thinkzap_access_group_lines` (`groupId`, `subscriptionItemId`), com FK em
   cascata para o grupo (e do grupo para `core_apps`), `@@unique` por
   (`appId`,`name` normalizado), (`groupId`,`bitrixUserId`) e
   (`groupId`,`subscriptionItemId`). `subscriptionItemId` **sem FK** (vive na
   SPA); ids órfãos são descartados na leitura ao cruzar com as linhas do
   contexto. Alternativa: coluna JSON no grupo — rejeitada por dificultar
   consulta por usuário e unicidade.
2. **Regra no domínio, função pura** `resolveAllowedLines({ hasGroups,
   userGroups, eligibleLineIds })`: sem grupos → todas; com grupos → união,
   vazia se nenhum. Facilita teste exaustivo dos cenários da spec.
3. **Rota de leitura para o widget** `GET /thinkzap/access/my-lines`
   registrada **antes** de `router.use(thinkzapAccessMiddleware)`, devolvendo
   `{ restricted: boolean, allowedLineIds: string[] }` para o `bitrixUserId`
   do JWT. O front cruza com `listSendableLines`. Sempre consulta o banco
   (sem usar o cache do contexto) para refletir mudanças na próxima abertura.
   Alternativa: embutir em `/api/application/me` — rejeitada por herdar o
   cache de 5 min e misturar módulos.
4. **Gate no servidor** `assertUserCanUseLine(appId, bitrixUserId,
   subscriptionItemId, eligibleLines)` chamado **nos controllers do widget**
   (send-widget, send-widget-multipart, send-widget-template,
   send-widget-button, line-status, widget-templates e rotas de template
   dependentes de linha), nunca nos casos de uso compartilhados, porque
   robôs/SMS os reutilizam e `operatorBitrixUserId` é opcional lá. Erro novo
   `LineNotAllowedError` (`domain/errors/line-not-allowed.error.ts`, mensagem
   pt-BR) mapeado em `mapWidgetSendError`. Alternativa: dentro de
   `EnqueueWidgetMessageUseCase` — rejeitada pelo impacto em robôs. Se o
   controller expuser pontos duplicados, extrair helper único de widget.
5. **Admin Bitrix sem bypass** no widget (decisão do enunciado: a regra vale
   para "usuários"); admins ainda administram os grupos independentemente de
   serem membros. Risco: admin pode ficar sem linha; mitigado porque ele edita
   os grupos.
6. **Front**: `conversation-view.tsx` busca `my-lines` junto do contexto;
   `lines` = elegíveis ∩ permitidas; com 1 linha, `selectedConnectorId`
   inicializa nela e o `<select>` fica `disabled`; com 0, mostra aviso e
   bloqueia envio mantendo texto/anexos. Lógica de filtro/pré-seleção
   extraída em função pura em `front/shared/` (testável em ambiente node, já
   que não há testes do componente).
7. **Administração**: nova aba "Grupos de acesso" em `administracao/page.tsx`
   (`SectionId` ganha `'grupos'`), componente em `_components/`, reutilizando
   o seletor de usuário (`portal-users`) e a lista de linhas do contexto.
   Textos em pt/en/es no namespace `thinkzap/administracao`. Rotas CRUD
   atrás de `requireThinkzapAdmin`, ao lado dos blocos de allowed-users.
8. **Limpeza de linha excluída**: ignorar órfãos na leitura; opcionalmente
   remover vínculos em `cleanup-deleted-spa-item-line.ts` (tarefa, sem
   impacto na spec).

## Risks / Trade-offs

- [Cache do contexto no front atrasa a lista de linhas] → `my-lines` não usa
  cache; o filtro é sempre aplicado sobre o contexto, e o servidor recusa o que
  estiver desatualizado.
- [`routes.ts` grande e disputado] → mudanças isoladas em dois blocos (rota do
  widget e CRUD admin); rebasear antes do PR.
- [Gate fora dos casos de uso pode esquecer um endpoint] → lista explícita de
  endpoints na `tasks.md` e teste por endpoint que prova a recusa.
- [Ativar o primeiro grupo restringe imediatamente todos que não estão em
  grupo] → aviso na tela de administração ao criar o primeiro grupo, informando
  que quem não estiver em nenhum grupo perde acesso às linhas.
- [Usuário em grupo sem linhas fica bloqueado] → aviso na lista de grupos
  para grupos sem linhas.
- [Proteção só no envio]: histórico e conversas continuam visíveis a quem abre
  o widget; fora do escopo.

## Migration Plan

1. Migration nova (sem alterar antigas) criando as 3 tabelas vazias; sem
   backfill — instalações sem grupos mantêm o comportamento atual.
2. Deploy da API antes do front (rota/gate inertes sem grupos).
3. Rollback: reverter o código; as tabelas vazias não interferem. Grupos já
   criados deixam de ser aplicados ao reverter, voltando ao acesso total.
