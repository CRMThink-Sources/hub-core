# Proposal

## Why

O menu Clientes do backoffice ficou para trás na reforma visual (`identidade-visual-portal-admin`). Ele não usa os componentes do portal (cabeçalho, painel, badge de status, estado vazio), mostra status cru e não deixa o suporte agir sobre o contrato. A aba Assinaturas da aplicação tem endpoint e componente, mas o botão dela foi tirado da tela. A persistência das aplicações também mudou com o tempo: a identidade foi para `core_apps`, o espelho foi para a SPA 1060 (`spa_id`) e a cobrança antiga `billing_subscriptions` saiu. Desde então nada mostra ao suporte quando uma instalação está sem espelho, com espelho apagado ou com o status parado em `ACTIVE`. Por isso a listagem de aplicações não é confiável.

## What Changes

- **Listagem de clientes** (`/admin/clientes`) refeita no padrão SaaS do portal:
  - cabeçalho com contagem;
  - busca por domínio ou member id;
  - filtros: "por aplicação" e "com pendência de espelho";
  - tabela responsiva com badge de status por aplicação, paginação no cliente e estados de carregamento, vazio e erro padronizados.
- **Detalhe do cliente** (`/admin/clientes/:id`) refeito:
  - cabeçalho com breadcrumb e link para o portal Bitrix do cliente;
  - indicadores: aplicações, assinaturas ativas, linhas e usuários MCP;
  - card de identificação;
  - aplicações em cards com o status do contrato e o estado do espelho.
- **Detalhe da aplicação** (`/admin/clientes/:id/apps/:appId`) passa a ter cabeçalho próprio (nome, app code, status, espelho, e-mail, instalada em) e abas:
  - Visão geral;
  - Assinaturas, que volta à tela;
  - Linhas;
  - Técnico, colapsado como hoje.

  O detalhe vale para qualquer app. As abas específicas do ThinkZap só aparecem para o ThinkZap.
- **Integridade do espelho**: a API classifica cada instalação como `linked` (espelho ok), `no-mirror` (`spa_id` nulo) ou `mirror-missing` (o `spa_id` aponta para um item que não existe mais na SPA 1060). O backoffice mostra o estado e oferece **"Vincular espelho"**. A ação procura o item na SPA 1060 pelo par (domínio, app code), usando a mesma regra do backfill, e grava o `spa_id`. Ela não cria item novo.
- **Ações na assinatura** (SPA 1142), na aba Assinaturas:
  - **Ativar** grava `Ativo`;
  - **Inativar** grava `Cancelado`, com confirmação;
  - nos dois casos o ciclo existente do webhook assina ou desassina as linhas no provider;
  - **Assinar todas no provider** roda a reconciliação das linhas da assinatura (mesma regra e mesma marca do ciclo);
  - as ações por linha (assinar, desassinar no provider) passam a ficar dentro da assinatura;
  - assinaturas com modalidade `stripe` não aceitam ativar nem inativar: o Stripe é a fonte da verdade.
- O assinar e o desassinar por linha do backoffice passam a gravar e limpar a marca de assinado, como todo outro caminho de subscribe.
- Ações que tocam o provider são recusadas onde os efeitos de provider estão desligados (homologação).
- Diagnóstico da persistência: um script só leitura conta as instalações por estado de espelho, os itens da SPA 1060 sem instalação e os itens duplicados por (domínio, app code). O resultado decide se haverá correções adicionais em outro change.

## Capabilities

### New Capabilities
- `portal-admin/clientes-backoffice`: listagem e detalhe de clientes no backoffice (busca, filtros, indicadores, aplicações do cliente).
- `portal-admin/aplicacao-backoffice`: detalhe da aplicação no backoffice (cabeçalho, abas, integridade do espelho e ação "Vincular espelho").
- `portal-admin/assinaturas-aplicacao`: listagem das assinaturas da aplicação e as ações de ativar, inativar e assinar no provider (todas ou por linha).

### Modified Capabilities
- `thinkzap/ciclo-provider-spa-assinatura`: o requisito "A marca de assinado acompanha todo caminho de subscribe e é limpa no unsubscribe" passa a incluir o assinar e o desassinar por linha e o "assinar todas" do backoffice.

## Impact

- **Front** (`front/`):
  - `components/layouts/admin/admin-clients-page.tsx`, `admin-clients-table.tsx`, `admin-client-detail-page.tsx`, `admin-app-settings-page.tsx`, `admin-app-subscriptions-section.tsx`, `admin-client-instances-section.tsx`;
  - componentes de `components/layouts/admin/ui/`;
  - `lib/portal-domains.ts`;
  - i18n `messages/{pt,en,es}/admin/clients.json`, `client-detail.json` e `app-settings.json`.
- **API** (`api/src/modules/portal`):
  - `GET /portal/domains` e `GET /portal/domains/:id` ganham o estado do espelho e os indicadores;
  - novos `GET /portal/apps/:appId`, `POST /portal/apps/:appId/link-mirror`, `POST /portal/apps/:appId/subscriptions/:subscriptionId/activate`, `.../deactivate` e `.../subscribe-lines`;
  - o subscribe e o unsubscribe por linha passam a gravar e limpar a marca.
- **CRM**: escrita de status na SPA 1142 e de `spa_id` em `core_apps`. Não há migração de schema.
- **Script**: `api/src/scripts/diagnose-aplication-mirrors.ts`, só leitura.
