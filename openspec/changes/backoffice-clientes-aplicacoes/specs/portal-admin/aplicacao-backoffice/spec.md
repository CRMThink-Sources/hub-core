# Spec Delta

## Purpose

Define o detalhe de uma aplicação instalada no backoffice: cabeçalho, abas, estado do espelho na SPA 1060 e a ação que religa a instalação ao item espelho dela.

## ADDED Requirements

### Requirement: Endpoint de detalhe da aplicação
A API SHALL expor `GET /portal/apps/:appId`. Ele só aceita sessão do portal e responde `401` sem sessão e `404` para instalação inexistente. A resposta SHALL trazer:
- id, app code (id e código), nome e título da instalação;
- status, e-mail, data de instalação e idioma;
- o domínio (id, nome, member id);
- o estado do espelho.

#### Scenario: Instalação existente
- **WHEN** um operador logado pede o detalhe de uma instalação ThinkZap com espelho
- **THEN** a resposta traz o título do item da SPA 1060, o domínio e o estado do espelho "linked"

#### Scenario: Instalação inexistente
- **WHEN** o id não existe em `core_apps`
- **THEN** a resposta é `404`

### Requirement: Estado do espelho da instalação
A API SHALL classificar o espelho de cada instalação em um destes estados:
- `linked`: `spa_id` preenchido e o item existe na SPA 1060;
- `no-mirror`: `spa_id` nulo;
- `mirror-missing`: `spa_id` preenchido, mas a SPA 1060 respondeu e o item não existe mais;
- `unknown`: a leitura da SPA 1060 falhou, então nada se conclui.

Uma falha de leitura SHALL resultar em `unknown`, nunca em `mirror-missing`. A listagem SHALL verificar todas as instalações em lote, e não com uma chamada por instalação.

#### Scenario: Item apagado à mão no CRM
- **WHEN** o item da SPA 1060 de uma instalação foi apagado e o evento de exclusão não chegou à API
- **THEN** o estado do espelho é `mirror-missing`

#### Scenario: Bitrix fora do ar
- **WHEN** a leitura em lote da SPA 1060 falha
- **THEN** toda instalação com `spa_id` aparece com estado `unknown`

### Requirement: Vincular espelho
A API SHALL expor `POST /portal/apps/:appId/link-mirror`, só com sessão do portal. A ação SHALL procurar na SPA 1060 o item da instalação pelo par (domínio, app code), com a mesma regra do backfill de `spa_id`, e responder:
- **um item encontrado**: grava o `spa_id` da instalação e responde `200` com o estado `linked`;
- **nenhum item**: não grava nada e responde `409` com o motivo `not-found`;
- **mais de um item**: não grava nada e responde `409` com o motivo `ambiguous` e os ids encontrados;
- **item já vinculado a outra instalação**: não grava nada e responde `409` com o motivo `taken`.

A ação SHALL NOT criar nem apagar item na SPA 1060 e SHALL NOT alterar nenhuma outra coluna da instalação. Ela só vale para instalações `no-mirror` ou `mirror-missing`. Para `linked` ela responde `409` com o motivo `already-linked`. Para `unknown` ela responde `409` com o motivo `unverified`: sem saber se o item atual existe, vincular outro por cima poderia trocar um espelho bom.

#### Scenario: Vincular instalação antiga
- **WHEN** o operador aciona "Vincular espelho" numa instalação `no-mirror`, e a SPA 1060 tem exatamente um item com aquele domínio e app code
- **THEN** o `spa_id` é gravado, a tela passa a mostrar "Vinculado" e a aba Assinaturas passa a ler o contrato

#### Scenario: Itens duplicados no CRM
- **WHEN** a SPA 1060 tem dois itens com o mesmo domínio e app code
- **THEN** nada é gravado, e a tela mostra os dois ids e pede correção no CRM

### Requirement: Cabeçalho e abas da aplicação
A tela `/admin/clientes/:id/apps/:appId` SHALL abrir para qualquer app. Ela SHALL mostrar:
- breadcrumb (Clientes › domínio › título da aplicação);
- cabeçalho com título, app code, status da instalação e estado do espelho;
- abas, nesta ordem: "Visão geral", "Assinaturas", "Linhas" (só ThinkZap) e o grupo "Técnico" (só ThinkZap), colapsado por padrão como hoje.

A aba ativa SHALL ficar no endereço (`?aba=assinaturas`). Recarregar a página ou compartilhar o link SHALL abrir a mesma aba.

#### Scenario: Aplicação que não é ThinkZap
- **WHEN** o operador abre uma instalação do Extrator
- **THEN** a tela mostra Visão geral e Assinaturas, sem Linhas nem Técnico

#### Scenario: Link direto para a aba
- **WHEN** o operador abre `/admin/clientes/:id/apps/:appId?aba=assinaturas`
- **THEN** a tela abre já na aba Assinaturas

### Requirement: Visão geral da aplicação
A aba "Visão geral" SHALL mostrar:
- os dados da instalação: e-mail, data de instalação, idioma, id da instalação e `spa_id`;
- o estado do espelho com a explicação do impacto (por exemplo: "Sem espelho: não é possível criar ou ler assinatura");
- o resumo do contrato: assinaturas por status e linhas.

Para `no-mirror` e `mirror-missing`, a aba SHALL mostrar a ação "Vincular espelho". Depois de vincular com sucesso, a tela SHALL recarregar o cabeçalho e o contrato.

#### Scenario: Espelho apagado
- **WHEN** a instalação está `mirror-missing`
- **THEN** a Visão geral mostra o aviso de espelho apagado com a ação "Vincular espelho"
