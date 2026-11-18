# Tasks

Branch: `task/grupos-acesso-widget-linhas` (a partir de `develop`).

## 1. Banco de dados

- [x] 1.1 Adicionar em `api/prisma/schema.prisma` os modelos de grupo, membro e linha do grupo (`thinkzap_access_groups`, `thinkzap_access_group_members`, `thinkzap_access_group_lines`) com FK em cascata, uniques e índice por `bitrixUserId`; `subscriptionItemId` sem FK
- [x] 1.2 Criar a migration nova (`npx prisma migrate dev --name add_thinkzap_access_groups`) seguindo o padrão `20260921120000_add_thinkzap_connection_notify_recipients`, e rodar `yarn prisma:generate`
- [x] 1.3 Validar o SQL com o agente `guardiao-migrations`

## 2. Domínio e persistência (API)

- [x] 2.1 Criar entidade e interfaces de repositório por operação em `modules/thinkzap/domain` (criar, renomear, excluir, listar, definir membros, definir linhas, buscar grupos do usuário, existe algum grupo)
- [x] 2.2 Criar a função pura `resolveAllowedLines` (sem grupos = todas; com grupos = união; vazia se nenhum) e teste cobrindo todos os cenários da spec
- [x] 2.3 Criar `LineNotAllowedError` em `domain/errors/line-not-allowed.error.ts` (mensagem pt-BR, com JSDoc do porquê)
- [x] 2.4 Implementar o repositório Prisma e testes no padrão `prisma-*.repository.test.ts` (nome único sem diferenciar caixa, cascata, descartar vínculo de linha inexistente)

## 3. Casos de uso e rotas da API

- [x] 3.1 Persistência e validação do CRUD de grupos (nome vazio/duplicado recusado com mensagem em português) nos controllers de `presentation/controllers/access-group`, no padrão dos allowed-users (sem casos de uso próprios: não há regra além da validação)
- [x] 3.2 Controllers, factories `main/make-*` e rotas de CRUD atrás de `requireThinkzapAdmin`, ao lado dos blocos de allowed-users em `routes.ts`; testes dos controllers (incl. recusa a quem não é admin)
- [x] 3.3 Rota `GET /thinkzap/access/my-lines` antes de `thinkzapAccessMiddleware`, devolvendo `{ restricted, allowedLineIds }` para o `bitrixUserId` do JWT, sem cache; teste
- [x] 3.4 Criar o serviço `WidgetLineAccess` e o middleware de rota `widgetLineGuard` (403 `line-not-allowed`), aplicado após o parser nas rotas `send-widget`, `send-widget-multipart`, `send-widget-template`, `send-widget-button`, `line-status/:id`, `widget-templates/:id` e `.../variable-values`; **não** aplicado em casos de uso compartilhados, robôs Bizproc, SMS e campanha
- [x] 3.5 Testar o middleware (recusa antes do controller, fluxo normal, sem linha legível, falha inesperada) e o serviço (sem grupos, união, fora de grupo, instalação ausente)
- [x] 3.6 Vínculo com linha excluída: `my-lines` devolve o id cru e quem cruza com as linhas do contexto (widget e tela de administração) descarta o órfão; nenhuma limpeza em `cleanup-deleted-spa-item-line.ts` é necessária
- [x] 3.7 Confirmar com o agente `auditor-ambientes` que nenhuma env/flag/fila nova é necessária (esperado: nenhuma)

## 4. Front: administração

- [x] 4.1 Cliente HTTP (`infra/`) e tipos dos endpoints de grupos e `my-lines`
- [x] 4.2 Nova aba "Grupos de acesso" em `app/(thinkzap)/thinkzap/administracao/page.tsx` (`SectionId` ganha `'grupos'`) com componente em `_components/`: lista, criar/renomear/excluir com confirmação, seletor de membros (reuso do picker de usuários) e de linhas
- [x] 4.3 Avisos: ao criar o primeiro grupo (quem não estiver em nenhum perde acesso às linhas) e grupos sem linhas
- [x] 4.4 Textos pt/en/es no namespace `thinkzap/administracao` (`front/messages`, `front/i18n`)

## 5. Front: widget

- [x] 5.1 Criar função pura em `front/shared/` que combina linhas elegíveis e `allowedLineIds` e devolve `{ lines, preselectedId, locked, noAccess }`, com testes `.test.ts`
- [x] 5.2 Em `app/(widgets)/layouts/conversation-view.tsx`: buscar `my-lines`, aplicar o filtro, pré-selecionar e travar o `<select>` com 1 linha, abrir sem seleção com 2+, e com 0 mostrar o aviso e bloquear o envio sem descartar texto/anexos; limpar a seleção se a linha deixar de ser permitida
- [x] 5.3 Textos do widget em português, no mesmo padrão (texto fixo) do restante de `conversation-view.tsx`

## 6. Verificação

- [x] 6.1 `api`: `yarn check-types`, `yarn lint` (zero warnings), `yarn test`
- [x] 6.2 `front`: `yarn check-types`, `yarn lint`, `yarn test`
- [x] 6.3 Rodar `revisor-codigo` no diff antes do commit
- [ ] 6.4 Validação manual em staging: instalação sem grupos (igual a antes); usuário com 1 linha (travada); com 2+ (sem seleção); fora de grupos (bloqueado); chamada direta à API com linha não permitida (recusada); robô Bizproc segue enviando
- [ ] 6.5 Depois do deploy e da validação, arquivar a change (`/opsx:archive`)
