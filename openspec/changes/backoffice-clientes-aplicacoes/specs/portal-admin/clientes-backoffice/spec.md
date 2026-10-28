# Spec Delta

## Purpose

Define a listagem e o detalhe de clientes no backoffice (`/admin/clientes`). São as telas em que o suporte encontra um portal Bitrix, vê as instalações dele, o estado do contrato e as pendências de espelho.

## ADDED Requirements

### Requirement: Listagem de clientes vem do banco
A listagem de clientes SHALL trazer todo domínio cadastrado em `core_domains` com as instalações dele em `core_apps`, do mais novo para o mais antigo. A ausência ou a falha do espelho na SPA 1060 SHALL NOT esconder cliente nem instalação. Da SPA 1060 vêm só o título de cada instalação e o estado do espelho.

#### Scenario: Instalação sem espelho continua na lista
- **WHEN** um domínio tem uma instalação com `spa_id` nulo
- **THEN** o domínio aparece na listagem, e a instalação aparece com o nome do app code e o estado de espelho "Sem espelho"

#### Scenario: CRM fora do ar
- **WHEN** a leitura da SPA 1060 falha ao montar a listagem
- **THEN** a listagem responde com todos os domínios e instalações, com o nome do app code como título e o estado de espelho "Não verificado"

### Requirement: Busca e filtros na listagem
A listagem SHALL oferecer:
- busca por domínio ou member id, sem diferenciar maiúsculas de minúsculas;
- filtro por aplicação (app code);
- filtro "Com pendência de espelho", que mostra só os clientes com ao menos uma instalação "Sem espelho" ou "Espelho apagado".

Os filtros SHALL se combinar com a busca. A listagem SHALL ser paginada com 25 clientes por página e mostrar o total filtrado. Se nada for encontrado, a tela SHALL mostrar um estado vazio com ação de limpar os filtros.

#### Scenario: Buscar por member id
- **WHEN** o operador digita parte do member id de um cliente
- **THEN** a tabela mostra só os clientes cujo member id contém o texto

#### Scenario: Filtrar pendências de espelho
- **WHEN** o operador liga o filtro "Com pendência de espelho"
- **THEN** só aparecem clientes com alguma instalação "Sem espelho" ou "Espelho apagado"

#### Scenario: Nenhum resultado
- **WHEN** a busca e os filtros não encontram cliente
- **THEN** a tela mostra o estado vazio com o botão "Limpar filtros"

### Requirement: Linha de cliente na tabela
Cada linha SHALL mostrar o domínio, o member id, as instalações (título e badge de estado do espelho quando ele não for "Vinculado") e a data de cadastro. A linha inteira SHALL levar ao detalhe do cliente e SHALL ser alcançável por teclado. Em telas estreitas, a tabela SHALL virar uma lista de cards, sem rolagem horizontal da página.

#### Scenario: Abrir pelo teclado
- **WHEN** o operador foca a linha de um cliente com Tab e pressiona Enter
- **THEN** o portal abre `/admin/clientes/:id`

#### Scenario: Celular
- **WHEN** a listagem é aberta numa tela de 375px de largura
- **THEN** cada cliente aparece como card com domínio, instalações e data, sem rolagem horizontal

### Requirement: Detalhe do cliente
O detalhe (`/admin/clientes/:id`) SHALL mostrar:
- cabeçalho com breadcrumb (Clientes › domínio), o domínio e um link que abre o portal Bitrix do cliente em nova aba;
- indicadores: número de aplicações, assinaturas ativas (somando as aplicações), linhas contratadas e usuários MCP do domínio;
- card de identificação: domínio, member id, cadastrado em, atualizado em;
- uma lista das aplicações do cliente, uma por card, com título, app code, status da instalação, estado do espelho, e-mail do instalador, data de instalação e o resumo do contrato.

Cada card de aplicação SHALL levar ao detalhe da aplicação, qualquer que seja o app.

#### Scenario: Cliente com duas aplicações
- **WHEN** o operador abre um cliente com ThinkZap (uma assinatura ativa com 3 linhas) e Extrator (sem assinatura)
- **THEN** os indicadores mostram 2 aplicações, 1 assinatura ativa e 3 linhas
- **AND** os dois cards levam ao detalhe da respectiva aplicação

#### Scenario: Cliente inexistente
- **WHEN** o operador abre `/admin/clientes/:id` com um id que não existe
- **THEN** a tela mostra "Cliente não encontrado" com um link de volta para a listagem

### Requirement: Contrato indisponível não é contrato vazio
O resumo do contrato de cada aplicação SHALL distinguir quatro estados, cada um com rótulo próprio:
- "Sem espelho": a instalação não tem `spa_id`;
- "Sem assinatura": tem espelho e não há assinatura;
- "Indisponível": a leitura da SPA 1142 falhou;
- a lista de assinaturas, cada uma com plano, status e quantidade de linhas.

Se a leitura falhar em uma aplicação, as outras aplicações SHALL continuar sendo mostradas. Os indicadores que dependem dessa leitura SHALL avisar que estão incompletos.

#### Scenario: CRM falha para uma aplicação
- **WHEN** a leitura da SPA 1142 falha só para a aplicação ThinkZap de um cliente com duas aplicações
- **THEN** o card do ThinkZap mostra "Indisponível", o outro card mostra o contrato dele
- **AND** o indicador de assinaturas ativas aparece marcado como incompleto

### Requirement: Status com componentes do portal
Status de instalação, de espelho e de assinatura nas telas de clientes SHALL usar o badge de status do portal, com a cor semântica do tema e o rótulo traduzido. SHALL NOT aparecer o valor cru do enum (por exemplo `ACTIVE` ou `past_due`).

#### Scenario: Assinatura vencida
- **WHEN** uma assinatura com status `past_due` aparece no detalhe do cliente
- **THEN** ela aparece com o badge de atenção e o texto "Vencido"
