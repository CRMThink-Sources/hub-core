# Tasks

## 0. Preparação

- [x] 0.1 Criar a branch `task/grupos-acesso-departamentos` a partir da `develop`; verificar com `git branch --show-current` e que arquivos alheios (ex.: `image.png`) ficam fora dos commits

## 1. Dados e CRUD

- [x] 1.1 Adicionar `ThinkzapAccessGroupDepartment` ao `schema.prisma`, criar migration nova e rodar `yarn prisma:generate`; verificar que o SQL só tem criação da tabela, índices e FK e que nenhuma migration antiga mudou
- [x] 1.2 Estender entidade, interface e repositório Prisma com `departments` (`create`, `list`, `update` preservando quando ausente, deduplicação); verificar com testes em `prisma-access-group.repository.test.ts`
- [x] 1.3 Aceitar `departments` opcional no schema dos controllers de grupo, com mensagem pt-BR para item inválido; verificar em `access-groups.controller.test.ts` os casos presente, ausente no POST e ausente no PUT

## 2. Departamentos do portal

- [x] 2.1 Criar a porta `DepartmentDirectory` e o adapter que pagina `department.get` pelo `BitrixClient`; verificar com teste de duas páginas e de erro de escopo
- [x] 2.2 Criar o cache em memória (TTL 5 min, busca única em voo, valor vencido em falha); verificar com testes de relógio falso cobrindo acerto, expiração, concorrência e falha com e sem valor anterior
- [x] 2.3 Expor `GET /thinkzap/portal-departments` com `requireThinkzapAdmin` e erro pt-BR quando indisponível; verificar com teste do controller e da recusa para não administrador
- [x] 2.4 Aceitar `ids` em `GET /thinkzap/portal-users` (paginado, inclui inativos, devolve `active`) sem mudar `search` e `id`; verificar com testes do controller, incluindo mais de 50 ids

## 3. Resolução do acesso

- [x] 3.1 Criar função pura de domínio que devolve os ancestrais dos departamentos do usuário; verificar com testes de vários níveis, múltipla lotação, id desconhecido e ciclo
- [x] 3.2 Fazer o repositório informar se há herança na instalação e considerar pessoa, lotação direta e ancestral com herança em `listLineIdsForUser`; verificar com testes do filtro
- [x] 3.3 Atualizar `WidgetLineAccess` para consultar a árvore só quando necessária e lançar `DepartmentsUnavailableError` conforme a decisão 5 do design; verificar em `widget-line-access.test.ts` os cenários de departamento da spec, incluindo que sem herança o diretório não é chamado
- [x] 3.4 Passar `bitrixDepartmentIds` pelo middleware e por `my-lines`, respondendo 503 com código próprio no erro novo, e ligar as factories ao diretório compartilhado; verificar nos testes do middleware e do controller que robôs e SMS seguem sem guard

## 4. Interface

- [x] 4.1 Criar em `front/shared/thinkzap/` a lógica do rascunho (adicionar/remover, opção de subdepartamentos, detecção de alteração, linhas ocultas preservadas, caminho do departamento, departamento não encontrado); verificar com `yarn test` no arquivo novo
- [x] 4.2 Criar `access-group-card.tsx` e a grade em `grupos-acesso-section.tsx`, resolvendo nomes por `ids` e `portal-departments`, com avisos, inativos, estado vazio e exclusão confirmada, e textos em pt, en e es; verificar no navegador os cenários de "Visão geral dos grupos em cards" em largura de desktop e de celular
- [x] 4.3 Criar `access-group-sheet.tsx` com selecionados no topo, abas Pessoas (busca no servidor com debounce) e Departamentos (com opção de subdepartamentos), linhas alternáveis, aviso do primeiro grupo, confirmação de descarte e erro mantendo o painel aberto, com textos em pt, en e es; verificar no navegador, inclusive só pelo teclado, os cenários de "Edição do grupo em painel lateral"
- [x] 4.4 Tratar departamentos indisponíveis na tela sem apagar vínculos; verificar simulando erro da rota e salvando o nome de um grupo com departamento

## 5. Verificação integrada

- [x] 5.1 Rodar `yarn check-types`, `yarn lint` e `yarn test` em `api` e em `front`; registrar no commit qualquer falha preexistente
- [ ] 5.2 Em staging, após o deploy: grupo com departamento e subdepartamento, confirmar linhas no widget com usuário direto, de subdepartamento e de fora, e envio recusado por linha não liberada
