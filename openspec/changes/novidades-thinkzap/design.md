# Design

## Context

O motivo e o escopo estão em `proposal.md`; o comportamento, nos specs. Pontos do código atual que moldam a abordagem:

- **Backoffice:**
  - módulo `api/src/modules/portal/` (camadas domain / application / infra / presentation / main);
  - rotas em `routes.ts` atrás de `portalAuthMiddleware`, montadas em `/api/portal` (`app.ts`);
  - sessão do portal é JWT `type: 'portal'` com `req.portalUserId`.
- **Portal Bitrix da CRMThink:** só é usado para saída, via `new BitrixClient({ webhook: env.crmthinkWebhookUrl })` (`shared/infra/clients/bitrix.client.ts`, `callMethod`). Hoje nada usa `tasks.task.*` nesse portal.
- **Entrada de eventos do portal:** `/api/webhooks/spa` (`spa-webhook.controller.ts`). Ele:
  - autentica pelo `application_token`;
  - responde `503` sem token configurado;
  - responde `200` para payload malformado;
  - enfileira o processamento (`spa-item-resource-sync`, consumido em `worker:spa-resource-sync`).
- **Jobs periódicos:** `shared/infra/scheduler/*.job.ts` (node-cron + lock em Redis + deps injetáveis), iniciados em `app.ts`.
- **R2:**
  - `make-template-image-storage.ts` cria o `S3Client` a partir de `env.r2`;
  - o bucket tem regra de expiração só no prefixo `template-headers/`;
  - upload via multer (`template-header-image-upload.multer.ts`).
- **Front:**
  - admin com componentes shadcn, nav em `admin-nav.ts` e i18n em `messages/{pt,en,es}/admin/*.json`, com teste de paridade;
  - ThinkZap com menu em `thinkzap-aside-config.ts`, i18next por namespace de caminho e idioma em `hub_locale`.
- **Ambientes:** homologação e produção compartilham o portal da CRMThink (por isso existe `THINKZAP_SPA_PROVIDER_EFFECTS_ENABLED`).

## Goals / Non-Goals

**Goals:**
- Seguir a mesma arquitetura em camadas e os mesmos padrões de webhook, fila e job que já existem, sem infraestrutura nova (nenhum processo ou serviço docker novo).
- Estado da novidade simples de raciocinar: a "situação" vista nas telas é derivada, nunca gravada.
- Toda decisão de conclusão passa por uma única função pura de regra, usada pelo webhook, pela reconciliação, pelo vínculo e pelas ações do backoffice.

**Non-Goals:**
- Histórico de versões de conteúdo (só existe a versão publicada e a versão em edição).
- Histórico de execuções da reconciliação no catálogo de jobs do backoffice (só log). Pode entrar depois.
- Limpeza de imagens órfãs no R2.

## Decisions

### D1. Módulo próprio `product-updates`
Criar `api/src/modules/product-updates/` com as mesmas camadas do `portal`. O módulo exporta:
- `createProductUpdatesPortalRoutes(portalAuthMiddleware)`, montado em `/api/portal/novidades`;
- o controller de leitura do cliente, registrado nas rotas do ThinkZap (`GET /api/thinkzap/novidades`);
- o controller do webhook, montado em `app.ts` como `/api/webhooks/crmthink-tasks`.

*Alternativa:* colocar tudo dentro de `modules/portal`. Rejeitada porque mistura a leitura do cliente e a integração de tarefas com o backoffice de clientes. O módulo próprio também isola os testes.

### D2. Modelo de dados: conteúdo em edição + snapshot publicado
Tabela `thinkzap_product_updates` (model `ProductUpdate`):

- `id` (uuid)
- `content` (JSON do MySQL, `Json` no Prisma): a versão em edição, `{ pt: {title, description}, en: {...}, es: {...}, imageKey: string|null }`
- `publishedContent` (JSON, nulo): o snapshot que o cliente vê
- `progress` (`PENDING` | `DONE`), `doneAt`, `completedBy`
- `visibility` (`DRAFT` | `PUBLISHED`), `firstPublishedAt`, `publishedAt`, `publishedBy`
- `availableAt` (nulo)
- `bitrixTaskId` (int, único, nulo), `bitrixTaskTitle`, `bitrixTaskStatus` (int), `bitrixTaskGroupId`, `bitrixTaskSyncedAt`
- `createdBy`, `createdAt`, `updatedAt`

Os campos `createdBy`, `completedBy` e `publishedBy` são FKs para `PortalUser`.

Derivações:

- **Situação:**
  - `Rascunho` se `visibility = DRAFT`;
  - `Disponível` se `PUBLISHED` e `availableAt` preenchido;
  - `Aguardando revisão` se `PUBLISHED`, `DONE` e sem `availableAt`;
  - `Em breve` nos demais casos.
- **Alterações pendentes:** `PUBLISHED` e `content ≠ publishedContent` (comparação profunda).
- **Ações de publicação:**
  - "Publicar alterações" copia `content` para `publishedContent`;
  - "Descartar" faz o inverso;
  - publicar (em breve ou disponível) também copia.
- **Exclusão:** só permitida com `firstPublishedAt` nulo.

*Alternativa:* tabela de revisões. Rejeitada porque só precisamos de duas versões, e colunas JSON deixam a cópia e a comparação triviais. *Alternativa:* um enum único de situação. Rejeitada porque a conclusão (que vem do Bitrix) e a visibilidade (que é decisão humana) mudam independentemente.

### D3. Regra de conclusão como função pura
`applyTaskStatus(update, taskStatus) → patch`, conforme o spec:
- status 5 → `DONE`;
- status 4 → mantém o estado e só atualiza o cache;
- outro status → `PENDING`, a menos que `availableAt` esteja preenchido.

Ela é idempotente e usada por quatro caminhos: vínculo, webhook (worker), reconciliação e "Marcar como concluída". "Desmarcar concluída" é uma ação explícita: reabre a tarefa e grava `PENDING`, limpando `availableAt` quando a novidade estiver despublicada.

### D4. Porta `CrmthinkTasksGateway`
Port no domínio, com o adapter `BitrixCrmthinkTasksGateway` sobre `BitrixClient({ webhook: env.crmthinkWebhookUrl })`:

| Operação | Chamada ao Bitrix |
|---|---|
| `getTask(id)` | `tasks.task.get` (`select`: ID, TITLE, STATUS, GROUP_ID, RESPONSIBLE_ID) |
| `searchTasks(term, groupId)` | `tasks.task.list` (filtro `GROUP_ID` e `%TITLE`, `order: {ID: 'desc'}`, 20) |
| `getTasks(ids)` | `tasks.task.list` com filtro `ID` em lotes de 50 |
| `createTask(...)` | `tasks.task.add` |
| `completeTask(id)` | `tasks.task.complete` |
| `renewTask(id)` | `tasks.task.renew` |
| `searchUsers(term)` | `user.search` (`ACTIVE: true`, `FIND`) |

Os limites por portal de `shared/infra/bitrix-limits` valem automaticamente. Os erros viram `CrmthinkTasksUnavailableError`, que os controllers mapeiam para `502`.

### D5. Webhook → fila → worker existente
O controller do webhook valida o token (`CRMTHINK_TASKS_WEBHOOK_TOKEN`) e lê `data.FIELDS_AFTER.ID` (ou `FIELDS_BEFORE.ID` no delete). Em seguida consulta o banco pelo índice único de `bitrixTaskId` e, se não houver vínculo, responde `200` e encerra. O portal inteiro dispara `ONTASKUPDATE`, então esse filtro barato é o que importa.

Para tarefa vinculada:
- **`ONTASKDELETE`:** desvincula direto, sem fila.
- **`ONTASKUPDATE`:** enfileira na nova fila `crmthink-task-sync` com `jobId = task-<id>` e `delay` de alguns segundos. Isso coalesce rajadas de updates da mesma tarefa.

A fila é consumida por um `Worker` registrado dentro do processo `worker:spa-resource-sync`, que já fala com o mesmo portal. O worker faz `getTask` e aplica D3.

*Alternativa:* processar de forma síncrona no request. Rejeitada porque o Bitrix espera resposta rápida e uma falha nossa não deve derrubar a entrega do evento. *Alternativa:* um worker novo. Rejeitado porque exigiria um serviço novo em `docker-compose.*`.

### D6. Reconciliação
`crmthink-tasks-reconcile.job.ts` segue o padrão de `stripe-sync.job.ts`:
- deps injetáveis, lock em Redis, `schedule` padrão `15 * * * *`;
- seleciona novidades com `bitrixTaskId` e `availableAt` nulo;
- `getTasks` em lote e D3 para cada uma;
- erro de lote é logado e não interrompe os outros lotes;
- tarefa que sumiu do Bitrix (não retornada) é tratada como excluída e desvinculada.

O job é iniciado em `app.ts` e desligado pela flag (D8).

### D7. Concluir/reabrir pelo backoffice é síncrono
"Marcar como concluída" chama `completeTask`, depois `getTask`, e então aplica D3. Assim, o caso "aguardando controle" fica pendente e a resposta traz `{ awaitingApproval: true }`. "Desmarcar" chama `renewTask` antes de gravar. Uma falha no Bitrix impede a gravação local. O `ONTASKUPDATE` que o próprio Bitrix dispara depois cai em D3 com o mesmo status, sem efeito, e não há loop.

### D8. Flags e configuração
- `CRMTHINK_TASKS_SYNC_ENABLED`: padrão `false`; ligar só em produção. Desligada, ela:
  - recusa criar, concluir e reabrir com tarefa (`409 tasks-sync-disabled`);
  - faz o webhook responder `200` sem processar;
  - não agenda a reconciliação.

  Buscar, vincular e ler continuam funcionando.
- `CRMTHINK_TASKS_GROUP_ID`: padrão `2677`.
- `CRMTHINK_TASKS_WEBHOOK_TOKEN`: vazio faz o webhook responder `503`.

Todas entram em `env.ts` e são documentadas em `api/.env.example`.

### D9. Imagem no R2
Novo adapter `R2ProductUpdateImageStorage`, que reaproveita o `S3Client` e `env.r2` (mesmo bucket):
- chave `product-updates/<uuid>.<ext>`, fora da regra de expiração;
- upload multer em memória, PNG/JPEG, até 5 MB;
- `imageKey` fica em `content`, e a URL pública é montada com `publicBaseUrl` na leitura;
- sem R2 configurado, o upload responde `503` e o resto funciona;
- trocar ou remover a imagem não apaga o objeto antigo (pode estar no snapshot publicado).

### D10. Leitura do cliente
`GET /api/thinkzap/novidades?locale=` usa o `authMiddleware` atual do ThinkZap. A consulta:
- seleciona `visibility = PUBLISHED`;
- projeta `publishedContent[locale]`, com `pt` como fallback defensivo;
- ordena `available` por `availableAt desc` e `soon` por `publishedAt desc`.

Não há paginação nem cache, porque é uma lista pequena. *Decisão minha:* revisitar se passar de algumas centenas de itens.

### D11. Front
- **Admin:**
  - `/admin/novidades` (lista) e `/admin/novidades/[id]` (edição; `nova` cria um rascunho e redireciona);
  - componentes em `front/components/layouts/admin/admin-product-updates-*.tsx`, com os mesmos primitivos shadcn e o mesmo shell;
  - busca de tarefa e de responsável com o `combobox` existente (`front/components/ui/combobox.tsx`) e debounce;
  - pré-visualização reaproveita o card do cliente, extraído para um componente compartilhado.
- **ThinkZap:** `app/(thinkzap)/thinkzap/novidades/page.tsx` com `Tabs`, namespace `thinkzap/novidades/page`.
- **Construção:** guiada pela skill `design-taste-frontend` (telas de app) e revisada com `web-design-guidelines`.

### D12. Vínculo do usuário do backoffice com o usuário do Bitrix
Coluna `bitrix_user_id` (inteiro, opcional) em `portal_users`, preenchida por um campo de ID no cadastro e editada por `PATCH /api/portal/users/:id` (`{ bitrixUserId: number | null }`). *Decisão minha:* sem índice único (dois usuários do backoffice apontando para o mesmo usuário do Bitrix é inofensivo) e sem validar o ID no Bitrix ao salvar (o escopo `user` do webhook pode ainda não estar ativo, e o ID é digitado por quem administra). O vínculo ainda não é usado por nenhuma ação das novidades; ele existe para a etapa de mensagens da tarefa, em que o autor da mensagem no Bitrix passa a ser este usuário (`AUTHOR_ID`) em vez do dono do webhook, e também pode sugerir o responsável ao criar tarefas.

### D13. Conversa da tarefa: ler pelo chat, enviar como o próprio usuário
No cartão novo de tarefas (módulo `tasks` 25.700.0+) os comentários são mensagens do chat da tarefa, e os métodos antigos de leitura (`task.commentitem.getlist/get`) não funcionam. A leitura detecta o modo pelo `chatId` de `tasks.task.get`: com `chatId`, usa `im.dialog.messages.get` (`DIALOG_ID = chat<chatId>`, `LIMIT` 50, autores pelo `users` da resposta, `author_id` 0 = mensagem do sistema); sem `chatId`, cai em `task.commentitem.getlist` (cartão antigo, ordenado do mais novo para o mais antigo e invertido). O envio usa `task.commentitem.add` com `AUTHOR_ID`, que a documentação diz continuar funcionando nos dois cartões. Ele está descontinuado (a documentação diz que integrações existentes podem continuar usando), mas é o único método com `AUTHOR_ID`: o atual, `tasks.task.chat.message.send` (REST 3.0, em `/rest/api/`), e o `im.message.add` só enviam em nome do dono do webhook. Por isso o envio tenta primeiro o antigo e, se ele falhar por qualquer motivo, cai no atual pelo mesmo webhook (URL com `/rest/api/`), com o texto prefixado `<nome> (via backoffice): `. O envio pelo caminho de fallback conta como enviado e é registrado em log como aviso (`attributedToAuthor: false`), para a gente notar antes de o método antigo parar de vez. Se os dois falharem, vale o erro do atual. A troca de caminho fica restrita ao adapter do gateway. O autor vem do `bitrixUserId` do usuário do backoffice (D12); sem ele o envio é recusado em vez de sair em nome do dono do webhook. O escopo `im` do webhook já existe.

## Risks / Trade-offs

- **Volume do webhook:** o portal todo dispara `ONTASKUPDATE` → filtro por índice único antes de qualquer outra coisa; resposta `200` imediata.
- **Permissão do usuário do webhook:** ele precisa poder ver, criar, concluir e reabrir tarefas no grupo 2677, além de ter os escopos `task` e `user`. → Na implantação, checar o usuário dono do webhook. Erros de permissão aparecem como `502` com a mensagem do Bitrix.
- **Homologação no portal real:** com a flag desligada, homologação não escreve nem processa eventos. Vincular em homologação grava `bitrixTaskId` só no banco de homologação, sem efeito no portal.
- **Evento perdido ou fora de ordem:** o worker sempre relê o status atual (nunca confia no payload), e a reconciliação horária corrige o resto.
- **`content` JSON sem schema no banco:** validar com zod nos casos de uso, num único ponto de parse.
- **Comparação de "alterações pendentes":** usar comparação profunda normalizada (trim nos textos) para não acusar diferença fantasma.

## Migration Plan

1. Deploy da migration (tabela nova, sem impacto no que já existe) e do código com `CRMTHINK_TASKS_SYNC_ENABLED=false`.
2. No portal da CRMThink:
   - garantir os escopos `task` e `user` no webhook de entrada;
   - criar o webhook de saída para `ONTASKUPDATE` e `ONTASKDELETE` apontando para `/api/webhooks/crmthink-tasks`;
   - copiar o token de aplicação para `CRMTHINK_TASKS_WEBHOOK_TOKEN`.
3. Em produção, ligar `CRMTHINK_TASKS_SYNC_ENABLED=true` e validar manualmente: vincular, criar, concluir em cada lado e reabrir.
4. **Rollback:** desligar a flag para parar a sincronização. Remover o item do menu do ThinkZap esconde a aba. A tabela pode ficar.
