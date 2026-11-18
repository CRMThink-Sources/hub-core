# Proposal

## Why

Hoje qualquer usuário do Bitrix com acesso ao widget do ThinkZap enxerga e pode
usar todas as linhas da instalação. Empresas com várias linhas (por equipe,
filial ou número) precisam separar quem atende por qual linha, sem depender de
disciplina do operador. Também falta uma forma de evitar envio pela linha
errada: o usuário que só deveria usar uma linha precisa abrir o widget com ela
já escolhida.

## What Changes

- Novo conceito de **grupo de acesso** do widget: um nome, um conjunto de
  usuários do Bitrix e um conjunto de linhas do ThinkZap (uma ou mais).
- Tela de administração para criar, renomear, excluir grupos e definir seus
  membros e suas linhas (nova aba "Grupos de acesso" na administração do
  ThinkZap, visível a quem já administra o acesso).
- Widget (conversa do CRM) passa a filtrar as linhas pelo grupo do usuário:
  - exatamente uma linha permitida: vem selecionada e o seletor fica travado;
  - mais de uma: vem sem seleção e o usuário escolhe entre as permitidas;
  - nenhuma permitida: o widget avisa que o usuário não tem linha liberada e
    bloqueia o envio.
- Sem nenhum grupo configurado na instalação, nada muda: todos usam todas as
  linhas.
- O servidor passa a **impor** a regra nos envios do widget (mensagem, anexo,
  template e botões): uma chamada direta à API com linha não permitida é
  recusada com erro em português.
- Premissas registradas (ver design): usuário em vários grupos recebe a **união**
  das linhas; havendo grupos, usuário que não está em nenhum não tem linha;
  administrador Bitrix segue a mesma regra no widget (sem bypass); robôs
  Bizproc, SMS e campanhas **não** são afetados.

## Capabilities

### New Capabilities
- `thinkzap/grupos-acesso-widget`: grupos de acesso (CRUD, membros, linhas),
  resolução das linhas permitidas por usuário, comportamento do seletor de
  linha no widget e imposição no servidor.

### Modified Capabilities
<!-- Nenhuma: não existe spec de seleção de linha no widget (a referência a
     `widget-line-listing` em placement-contact-center é de uma capability que
     não existe em openspec/specs). O comportamento novo fica na capability
     nova. -->

## Impact

- **API** (`api/`): 3 tabelas novas + migration (`thinkzap_access_groups`,
  membros, linhas); repositórios, casos de uso, controllers e rotas de CRUD
  atrás de `requireThinkzapAdmin`; rota de leitura das linhas permitidas ao
  usuário do widget (fora do `thinkzapAccessMiddleware`); gate
  `assertUserCanUseLine` nos controllers do widget; erro de domínio novo mapeado
  em `mapWidgetSendError`.
- **Front** (`front/`): aba nova em `app/(thinkzap)/thinkzap/administracao`,
  filtro/pré-seleção/trava em `app/(widgets)/layouts/conversation-view.tsx`,
  mensagens i18n (pt/en/es).
- **Sem mudança** em modelos de linha: a linha é item da SPA do Bitrix, e o
  `subscriptionItemId` é a chave de associação (sem FK; ids órfãos são
  ignorados na leitura).
- **Riscos**: cache do contexto da aplicação no front (até 5 min) pode atrasar
  a lista; `routes.ts` é arquivo grande e disputado; o gate não pode entrar em
  casos de uso compartilhados com robôs/SMS.
