# Design

## Context

Ver `proposal.md` (Why). Estado observado:

- Grupos em três tabelas (`thinkzap_access_groups`, `_members`, `_lines`); a
  decisão fica em `resolveLineAccess` (função pura) e no serviço
  `WidgetLineAccess`, usado por `GET /thinkzap/access/my-lines` e pelo middleware
  das rotas do widget.
- O JWT já carrega `bitrixDepartmentIds` (lotação direta, de `UF_DEPARTMENT` no
  login) e `req.bitrixDepartmentIds` está disponível. Os widgets autenticam a cada
  abertura (`authenticateBitrixWithBackend`).
- A aba Permissões já libera por departamento, só por lotação direta, e busca
  departamentos pelo browser (`front/bitrix/department-search.ts`).
- `GET /thinkzap/portal-users` faz **uma** chamada a `user.get` (50 registros,
  só ativos) e aceita um único `id`. A tela de grupos a chama sem busca e filtra
  no cliente.
- A tela atual é um único componente (`grupos-acesso-section.tsx`).
- `useMyLineAccess`: em erro de leitura o widget mostra todas as linhas e quem
  recusa é o servidor.

## Goals / Non-Goals

**Goals:**
- Instalação sem departamentos com herança não faz nenhuma chamada nova ao
  Bitrix no caminho de envio.
- Resolução de departamentos em função pura, testável.
- Implantação API antes do front sem perda de dados.

**Non-Goals:**
- Herança de subdepartamentos na aba Permissões.
- Contar ou listar as pessoas de um departamento na tela.
- Cache compartilhado (Redis) da hierarquia.
- Atualizar a lotação do usuário sem novo login.

## Decisions

1. **Tabela nova `thinkzap_access_group_departments`** (`groupId`,
   `bitrixDepartmentId`, `includeSubdepartments` default `false`), FK em cascata
   para o grupo, `@@unique([groupId, bitrixDepartmentId])` e índice em
   `bitrixDepartmentId`. Nomes não são gravados: vêm do portal na leitura, para
   não ficarem velhos. Alternativa: coluna de tipo na tabela de membros —
   rejeitada por alterar a tabela existente e misturar ids de naturezas
   diferentes.

2. **Herança resolvida na hora do acesso**, guardando só o departamento escolhido.
   Para o usuário calculam-se dois conjuntos: lotação direta (do token) e
   ancestrais (subindo `PARENT` na árvore, com proteção contra ciclo). Um vínculo
   concede acesso se o id está na lotação direta, ou se está nos ancestrais e
   `includeSubdepartments`. Alternativa: expandir os filhos ao salvar — rejeitada
   porque subdepartamento criado depois ficaria de fora.

3. **Árvore só quando necessária**: o serviço consulta o portal apenas se a
   instalação tiver algum vínculo com herança e o usuário tiver lotação. O
   repositório expõe essa pergunta e recebe os dois conjuntos em
   `listLineIdsForUser` (um único filtro `OR`: pessoa, departamento direto,
   ancestral com herança).

4. **Porta `DepartmentDirectory`** no domínio (`list(installedAppId)` →
   `{ id, name, parentId }[]`), com adapter que pagina `department.get` pelo
   `BitrixClient` (credencial da instalação, passando por `bitrix-limits`) e
   decorator de cache em memória por instalação: TTL de 5 min, uma busca em voo
   por instalação e retorno do valor vencido quando a atualização falha. A mesma
   instância serve o gate e a rota de administração (singleton no `main/`).
   Alternativas: Redis — desnecessário, a consulta é rara e barata por processo e
   os índices de cache são compartilhados entre ambientes; `BX24.callMethod` no
   browser — não serve ao servidor.

5. **Falha sem árvore conhecida**: calcula-se o acesso só com pessoa e lotação
   direta. `assertCanUse` lança `DepartmentsUnavailableError` (503, código
   próprio, mensagem pt-BR) quando a linha não está nesse conjunto e a herança
   não pôde ser avaliada. `my-lines` responde o mesmo erro quando a herança não
   pôde ser avaliada, e o front cai no comportamento de erro já existente.
   Alternativas: liberar tudo (fura a regra) ou responder "linha não permitida"
   (mensagem enganosa).

6. **Contrato do CRUD**: o grupo ganha
   `departments: { departmentId, includeSubdepartments }[]`. No corpo, o campo é
   **opcional**: ausente no `PUT` preserva os vínculos (aba antiga aberta durante
   o deploy não apaga nada); ausente no `POST` vira lista vazia. Ids repetidos
   são deduplicados.

7. **Leituras para a tela** (atrás de `requireThinkzapAdmin` para departamentos):
   - `GET /thinkzap/portal-departments` → todos os departamentos com `parentId`
     (o front busca e monta o caminho "Comercial › SDR" no cliente);
   - `GET /thinkzap/portal-users?ids=1,2,3` → resolve membros gravados, paginando,
     sem filtrar por ativo e devolvendo `active`. `search` e `id` continuam como
     hoje (usados pelo editor de bots e pelas notificações). A busca de pessoas
     na tela usa `search` com debounce e mínimo de 2 caracteres.

8. **Front**, reaproveitando `Sheet`, `Button`, `Input`, `Switch` e
   `PermissionsUserAvatar`:
   - `grupos-acesso-section.tsx`: carregamento e grade responsiva de cards (1/2/3
     colunas), estado vazio com chamada para criar;
   - `access-group-card.tsx`: avatares (até 5 + "+N"), chips de departamento,
     linhas, avisos e ações editar/excluir (com confirmação);
   - `access-group-sheet.tsx`: nome, "Quem tem acesso" (chips removíveis; chip de
     departamento com a chave "incluir subdepartamentos"), abas Pessoas /
     Departamentos com busca e botão adicionar, linhas como botões alternáveis com
     `aria-pressed`, rodapé fixo e confirmação de descarte. Sem busca digitada, a
     aba Departamentos lista a árvore e a de Pessoas pede um nome;
   - lógica pura (rascunho, detecção de alteração, caminho de departamento,
     preservação de linhas ocultas) em `front/shared/thinkzap/`, com testes em
     ambiente node.

## Risks / Trade-offs

- [App sem escopo `department` no portal] → tela mostra aviso e preserva
  vínculos; acesso por pessoa não muda.
- [`UF_DEPARTMENT` vem do front quando `user.current` falha no login] → mesmo
  modelo de confiança da aba Permissões; sem mudança nesta change.
- [Token antigo mantém a lotação anterior] → vale no próximo login; o widget
  autentica a cada abertura.
- [Cache por processo: réplicas podem divergir por até 5 min] → dentro do prazo
  especificado.
- [Portal com muitos departamentos: paginação lenta na primeira abertura] →
  cache e busca única em voo.
- [Rollback depois de criar grupos só com departamentos] → o código anterior os
  vê sem membros e esses usuários ficam sem linha; ao reverter, adicionar pessoas
  ou excluir o grupo.

## Migration Plan

1. Migration nova, só com `CREATE TABLE`; sem backfill.
2. Deploy da API antes do front (campo opcional garante compatibilidade).
3. Rollback: reverter o código; a tabela pode permanecer (ver risco acima).
4. Validar em staging com um departamento com subdepartamento, confirmando que o
   `department.get` responde com a credencial da instalação.
