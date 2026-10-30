# Proposal

## Why

Os clientes do ThinkZap não têm onde ver o que mudou no produto nem o que está por vir. Hoje isso só chega por conversa com o suporte. O time quer uma aba "Novidades" dentro do ThinkZap, em linguagem de produto, curada no backoffice. Cada novidade pode ser ligada à tarefa do Bitrix24 da CRMThink onde o desenvolvimento é acompanhado, e a conclusão é sincronizada nos dois sentidos para ninguém precisar atualizar dois lugares.

## What Changes

- **Novidades no backoffice** (`/admin/novidades`): criar, editar, publicar, despublicar e excluir (só rascunhos) novidades do ThinkZap, com título e descrição em pt, en e es, e imagem opcional no R2.
  - Ciclo de vida: Rascunho → Em breve (publicada) → Concluída, aguardando revisão → Disponível (publicada). Um rascunho concluído pode ir direto para Disponível.
  - Publicar exige os três idiomas completos.
  - Concluir nunca publica: "Publicar como disponível" é sempre um passo humano.
  - Alterações em novidade já publicada ficam pendentes até "Publicar alterações". O cliente continua vendo a versão publicada.
  - Despublicar esconde do cliente sem apagar a data de disponibilidade; republicar mantém a data original.
- **Vínculo com tarefa do Bitrix da CRMThink** (portal interno, via `CRMTHINK_WEBHOOK_URL`):
  - busca por ID ou por título no projeto "Produtos | Desenvolvimento e Sustentação" (grupo 2677, configurável); tarefa de outro grupo vinculada por ID gera aviso;
  - criação da tarefa a partir do backoffice, com o responsável escolhido numa busca de usuários do portal;
  - uma tarefa vincula no máximo uma novidade.
- **Sincronização de conclusão**:
  - Bitrix → backoffice: novo endpoint recebe `ONTASKUPDATE`/`ONTASKDELETE` do portal da CRMThink (token próprio). Ele ignora tarefas não vinculadas e enfileira a leitura do status. Só o status "concluída" (5, aprovada) conclui a novidade. "Aguardando controle" (4) não conclui. Tarefa reaberta devolve a novidade para pendente, a não ser que ela já esteja disponível.
  - backoffice → Bitrix: "Marcar como concluída" conclui a tarefa no Bitrix e só então reflete o status resultante. Se a tarefa ficar aguardando aprovação, a novidade continua pendente com aviso. "Desmarcar concluída" reabre a tarefa.
  - Uma reconciliação de hora em hora cobre eventos perdidos.
  - Uma flag de ambiente desliga as escritas no Bitrix e o processamento do webhook, porque homologação e produção compartilham o portal.
- **Aba "Novidades" no ThinkZap** (`/thinkzap/novidades`): lista única para todos os clientes, no idioma do cliente. Tem as abas internas "Já disponível" (padrão, com data) e "Em breve" (sem datas), com cards de título, descrição e imagem.
- **Menu do admin** ganha o item Novidades.
- **Usuário do backoffice ligado ao usuário do Bitrix**: campo opcional "ID no Bitrix" no cadastro e na edição dos usuários do backoffice. Ele permite atribuir à pessoa certa as ações feitas no Bitrix a partir do backoffice (como mensagens na tarefa da novidade, numa etapa seguinte).

Fora do escopo: integração com GitHub, tradução automática, prazos para itens futuros, notificações, conteúdo por cliente, novidades de outros produtos.

## Capabilities

### New Capabilities
- `portal-admin/novidades-backoffice`: cadastro, ciclo de vida, revisão e publicação de novidades do ThinkZap no backoffice (conteúdo trilíngue, imagem, alterações pendentes).
- `portal-admin/novidades-tarefas-bitrix`: vínculo de novidades com tarefas do Bitrix da CRMThink (busca, criação com responsável) e sincronização bidirecional da conclusão (webhook, reconciliação, flag de ambiente).
- `thinkzap/novidades-cliente`: aba "Novidades" do ThinkZap para o cliente final e o endpoint de leitura que a alimenta.

- `portal-admin/usuarios-vinculo-bitrix`: ID do usuário do Bitrix da CRMThink no cadastro de usuário do backoffice (criar, editar, listar).

### Modified Capabilities
- `portal-admin/navegacao-portal-admin`: a navegação agrupada passa a incluir o item Novidades (`/admin/novidades`) no grupo geral.

## Impact

- **API**:
  - novo model Prisma e migration;
  - novos casos de uso, controllers e rotas em `/api/portal/novidades/*` (atrás de `portalAuthMiddleware`);
  - novo endpoint de cliente `GET /api/thinkzap/novidades` (atrás de `authMiddleware`);
  - novo webhook `POST /api/webhooks/crmthink-tasks`;
  - nova fila BullMQ consumida no processo `worker:spa-resource-sync`;
  - novo job node-cron de reconciliação;
  - novo prefixo no bucket R2 existente.
- **Bitrix24 da CRMThink**:
  - o webhook de entrada (`CRMTHINK_WEBHOOK_URL`) precisa dos escopos `task` e `user`;
  - é preciso cadastrar um webhook de saída/handler para `ONTASKUPDATE` e `ONTASKDELETE`;
  - usa os métodos `tasks.task.get/list/add/complete/renew` e `user.search`.
- **Env novas**: `CRMTHINK_TASKS_WEBHOOK_TOKEN`, `CRMTHINK_TASKS_GROUP_ID` (padrão 2677), `CRMTHINK_TASKS_SYNC_ENABLED`, com documentação em `api/.env.example`.
- **Front**:
  - novas páginas no admin e i18n em `front/messages/{pt,en,es}/admin/`;
  - nova página no ThinkZap, entrada em `thinkzap-aside-config.ts` e i18n em `front/messages/{pt,en,es}/thinkzap/`.
