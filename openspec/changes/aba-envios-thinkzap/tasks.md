# Tasks

## 1. Banco

- [x] 1.1 Em `api/prisma/schema.prisma`, adicionar em `ThinkzapWidgetOutbox` os índices `@@index([domainId, createdAt])` e `@@index([domainId, operatorBitrixUserId, createdAt])`, com comentário explicando que servem à aba Envios. Criar a migration SQL aditiva à mão (só `CREATE INDEX`), sem rodar `migrate dev/deploy` contra banco nenhum, e rodar `yarn prisma:generate`. Verificar: `git diff --stat api/prisma/migrations` mostra só a pasta nova e o `guardiao-migrations` aprova (nomes dos índices dentro do limite de 64 caracteres, nenhuma migration antiga alterada).

## 2. Consulta no repositório

- [x] 2.1 Criar o módulo puro de filtros da lista em `modules/thinkzap/domain/send-list-filters.ts` (período limitado a 90 dias com padrão de 7, normalização do trecho de telefone para dígitos, lista de status aceitos, `page`/`limit` com teto) e o teste ao lado. Verificar: `yarn test` no arquivo cobre período acima de 90 dias limitado, trecho com máscara e código do país, status inválido recusado e `limit` acima do teto.
- [x] 2.2 Criar `PrismaSendListRepository` em `modules/thinkzap/infra/persistence/repositories/` com `list(filters, scope)` e `findDetail(id, scope)`: agrupamento por `(COALESCE(dispatch_group_id, id), destination)` em `$queryRaw` parametrizado (total e ids da página, com o `CASE` de status espelhando `summarizeRecipients`, comentado nos dois lugares), leitura das partes da página pelo cliente Prisma e filtro fixo por `domain_id`, `app_code`, origens rastreadas e `sms_message_id IS NULL`. `scope` traz `domainId`, `appCode`, `onlyOperatorId` (nulo para administrador). Verificar: teste do repositório (mock do `prisma` como nos vizinhos) confirma que nenhum valor do usuário é interpolado no SQL, que `onlyOperatorId` entra no filtro e que o detalhe de outro remetente ou outra instalação devolve `null`.

## 3. Casos de uso

- [x] 3.1 Criar `ListSends` em `modules/thinkzap/application/`: aplica a regra de perfil (administrador vê tudo e pode filtrar por remetente; os demais sempre só os próprios, ignorando `senderId`), calcula o estado de cada linha com `summarizeRecipients`, traduz o motivo com `describeSendFailure` no idioma da instalação (frase genérica quando não há motivo), resolve o nome da linha pelo contexto da instalação e o dos remetentes por um `user.get` em lote com falha tolerada (`name: null`), e devolve também as opções de linha e de remetente. Verificar: testes de matriz cobrem administrador x operador, robô sem usuário, `senderId` ignorado para o operador, Bitrix fora do ar na resolução de nomes, motivo em pt, en e es e falha sem motivo.
- [x] 3.2 Criar `GetSendDetail`: mesma checagem de visibilidade, devolve texto, template, horários, motivo com código, partes e o link do registro do CRM via `crmRecordReference`; qualquer negação responde "não encontrado". Verificar: testes de detalhe de envio alheio, de outra instalação, inexistente e com mais de 90 dias, todos "não encontrado", e de envio de entidade fora do CRM (sem link).

## 4. API

- [x] 4.1 Criar os controllers `GET /messages/sends` e `GET /messages/sends/:id` com validação Zod (`from`, `to`, `status`, `line`, `destination`, `senderId`, `page`, `limit`), as factories em `modules/thinkzap/main/` e registrar as rotas em `routes.ts` **depois** de `thinkzapAccessMiddleware`, sem `requireThinkzapPermission`. Verificar: testes de controller cobrem parâmetros inválidos (400), usuário sem acesso (403 do middleware), detalhe alheio (404) e resposta no formato do contrato do design; um teste de rotas garante que as duas rotas ficam atrás do middleware (como `routes-insights-permission.test.ts`).
- [x] 4.2 Garantir que nenhum log novo carrega texto de mensagem ou telefone (apenas contagem e filtros) e documentar as rotas no `README`/spec da change quando houver lista de rotas. Verificar: busca nos novos arquivos por `logger` mostra só campos sem dado pessoal, conferida em revisão.

## 5. Front

- [x] 5.1 Adicionar o item `envios` em `front/components/layouts/shared/aside/thinkzap-aside-config.ts` e o rótulo nos três `aside.json`, sem filtro de permissão em `app/(thinkzap)/layout.tsx` (aparece para quem tem `canAccess`). Verificar: teste do filtro de links do layout (ou da config) mostra o item para um usuário sem papel de administrador e `yarn check-types` passa.
- [x] 5.2 Criar `_lib/thinkzap-sends-client.ts` (lista e detalhe sobre `resolveThinkzapClient`), os tipos do contrato e os helpers puros (leitura e escrita da query string dos filtros, rótulo e cor por status) com testes `.test.ts`. Verificar: `yarn test` no front cobre ida e volta dos filtros pela query string, valor inválido caindo no padrão e todos os status mapeados.
- [x] 5.3 Criar a página `app/(thinkzap)/thinkzap/envios/page.tsx` com barra de filtros (período, status, linha, destinatário e, só para administrador, remetente), tabela paginada, painel lateral de detalhe, estados de carregando, vazio e erro, aviso do prazo de 90 dias e da limitação da Z-API, e os `envios.json` em pt, en e es. Verificar: `yarn check-types`, `yarn lint` e `yarn build` passam; as três traduções têm as mesmas chaves (teste ou script de conferência existente do projeto); conferência manual da tela com dados de teste no ambiente local ou staging.
  - Pendente: a conferência visual da tela não foi feita na implementação (feita sem navegador); conferir em staging: filtros e voltar do navegador, administrador x operador (filtro de remetente), painel de detalhe e link do CRM, estados vazio/erro, as três línguas; entra na lista da tarefa 6.2.

## 6. Integração e entrega

- [x] 6.1 Rodar `yarn check-types`, `yarn lint` e `yarn test` em `api/` e `front/` e corrigir o que a mudança tocar. Verificar: os três comandos sem erro nem warning nos dois pacotes (falha preexistente é anotada no commit).
- [x] 6.2 Registrar em `openspec/changes/status-entrega-envios-thinkzap/tasks.md` a etapa 3 como implementada e a lista de validação em staging: migration aplicada, desempenho da lista com volume real, equivalência do filtro de status com o estado exibido, administrador x operador x robô sem usuário, detalhe de envio alheio respondendo "não encontrado", nomes de remetente com o Bitrix lento, as três línguas. Verificar: o arquivo atualizado e commitado junto com a change.
