# Proposal

## Why

Os grupos de acesso do widget só aceitam usuários um a um: quem libera linhas
para um setor inteiro precisa marcar cada pessoa e lembrar de atualizar o grupo a
cada contratação ou troca de setor. A tela também esconde quem já está no grupo
(nomes truncados numa linha de texto e uma lista de caixas de seleção em que os
marcados se perdem), e hoje só carrega a primeira página de usuários do portal
(50), de modo que membros além dela aparecem como número.

## What Changes

- Um grupo de acesso passa a aceitar **departamentos do Bitrix24** como membros,
  além de usuários.
- Ao adicionar um departamento, o administrador escolhe se ele **inclui
  subdepartamentos**; a escolha pode ser alterada depois. Sem incluir, vale só
  para quem está lotado diretamente no departamento.
- A permissão do usuário no widget passa a considerar a união dos grupos em que
  ele está **como pessoa ou por departamento**.
- Nova interface de Grupos de acesso, com menos cara de tabela:
  - grade de **cards**, um por grupo, mostrando avatares das pessoas,
    departamentos, linhas e avisos (sem linhas, sem ninguém);
  - edição em **painel lateral**, com "quem já tem acesso" sempre visível no topo
    como itens removíveis;
  - busca de pessoas e departamentos separada, indicando o que já foi adicionado;
  - linhas como opções clicáveis em vez de lista de caixas de seleção;
  - confirmação antes de descartar alterações não salvas.
- Correção: a busca de pessoas passa a consultar o portal (alcança qualquer
  usuário, não só os 50 primeiros) e os membros já gravados aparecem pelo nome,
  inclusive os desativados no Bitrix24, que são sinalizados.

Sem mudança **BREAKING**: grupos existentes continuam valendo como estão.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `thinkzap/grupos-acesso-widget`: departamentos como membros do grupo (com opção
  de subdepartamentos), resolução de linhas permitidas por pessoa ou
  departamento, busca de membros e apresentação dos grupos na administração.

## Impact

- **Banco** (`api/prisma`): migration nova com a tabela de departamentos do grupo.
- **API** (`api/src/modules/thinkzap`): entidade, repositório, CRUD de grupos,
  resolução de linhas permitidas, rota `my-lines` e guard das rotas do widget;
  leitura de departamentos do portal (`department.get`) no servidor; consulta de
  usuários do portal por vários ids.
- **Front** (`front/app/(thinkzap)/thinkzap`): reescrita de
  `grupos-acesso-section.tsx` em componentes menores; textos em pt, en e es.
- **Bitrix24**: exige o escopo `department` no app (já usado pela aba de
  permissões); quando indisponível, grupos só por pessoas seguem funcionando.
- **Fora do escopo**: aba de Permissões, robôs de processo, SMS e campanhas.
