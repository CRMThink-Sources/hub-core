# Tasks

## 1. Diagnóstico da persistência

- [x] 1.1 Extrair a busca do item da SPA 1060 por (domínio, app code) de `scripts/backfill-aplication-spa-id.ts` para `findAplicationSpaItems` no módulo `application`. O backfill passa a usá-la. Verificação: teste unitário com 0, 1 e 2 itens, e `yarn tsx src/scripts/backfill-aplication-spa-id.ts --dry-run` com a mesma saída de antes.
- [x] 1.2 Criar `api/src/scripts/diagnose-aplication-mirrors.ts`, só leitura, com saída em tabela e `--json`. Ele conta:
  - instalações por estado de espelho;
  - itens da SPA 1060 sem instalação;
  - duplicados por (domínio, app code);
  - instalações por `status`.

  Verificação: roda contra homologação sem nenhuma escrita (conferir que só há chamadas `crm.item.list` no log).
- [ ] 1.3 Rodar o diagnóstico em produção e registrar as contagens em `openspec/changes/backoffice-clientes-aplicacoes/diagnostico.md`. Verificação: o arquivo existe com os números e a data.

## 2. API: integridade do espelho e detalhe da aplicação

- [x] 2.1 Adicionar `getMirrorsBySpaIds` ao `AplicationTitleReader` e ao `BitrixAplicationTitleReader`. Ele devolve `titles` e `unverified` (ids dos lotes que falharam). `getTitlesBySpaIds` passa a delegar a ele. Verificação: teste com um lote ok e um lote com erro (os ids do segundo aparecem em `unverified`).
- [x] 2.2 Adicionar `mirror: 'linked' | 'no-mirror' | 'mirror-missing' | 'unknown'` em `PortalDomainApp` e preencher em `hydrateAppTitles` (D1). Verificação: testes de `list-portal-domains` e `get-portal-domain-detail` cobrindo os quatro estados, incluindo falha de leitura → `unknown`.
- [x] 2.3 Adicionar ao detalhe do domínio os indicadores do cliente: aplicações, assinaturas ativas, linhas e usuários MCP, com a flag `incomplete` quando algum contrato veio `unavailable`. Verificação: teste de `get-portal-domain-detail` com um app `unavailable` → `incomplete: true`.
- [x] 2.4 Criar `GET /portal/apps/:appId` (caso de uso, factory, controller e rota) devolvendo o detalhe da instalação com domínio, título e espelho. Verificação: testes do caso de uso (existente → dados + `mirror`; inexistente → `404`) e `401` sem sessão.
- [x] 2.5 Criar `POST /portal/apps/:appId/link-mirror` (`LinkAplicationMirror`), com as respostas `already-linked`, `not-found`, `ambiguous` (com ids), `taken` (inclusive via `P2002`) e sucesso, que grava `spa_id` e invalida o cache. Verificação: um teste unitário por motivo e um de sucesso, conferindo que nenhuma outra coluna é escrita.

## 3. API: ações na assinatura

- [x] 3.1 Criar `ProviderEffectsDisabledError` e o mapeamento dele para `409 { reason: 'provider-effects-disabled' }` nos controllers do portal. Verificação: teste do controller.
- [x] 3.2 Criar `ActivateSubscription`, que confere se a assinatura pertence à instalação (`404` se não), recusa `stripe` (`409 gateway-managed`) e `active` (`409`), e exige um novo fim de período posterior a hoje quando o período já terminou (`422`). Ele grava `active`, `pastDueAt: null` e o período opcional. Verificação: um teste unitário por regra, com o repositório falso conferindo o patch exato.
- [x] 3.3 Criar `DeactivateSubscription`, com a mesma checagem de pertencimento e a recusa de `stripe`. Para assinatura já `cancelled`, responde `409`. Ele grava `cancelled` e `canceledAt` = hoje. Verificação: testes unitários com o patch exato.
- [x] 3.4 Criar o endpoint `subscribe-lines`, que executa `SyncSubscriptionLinesBilling` de forma síncrona com o `traceKey` do backoffice. Ele captura `SubscriptionLinesBillingError` e devolve `{ items, subscribed, unsubscribed, ignored, failed }`. Verificação: teste com uma linha ok, uma ignorada e uma com falha → `200` com as contagens.
- [x] 3.5 Registrar as rotas `activate`, `deactivate` e `subscribe-lines` em `modules/portal/routes.ts` com `portalAuthMiddleware` e a recusa por ambiente (`provider-effects-disabled`) nas três. Verificação: testes dos controllers com a flag desligada → `409` sem chamar o caso de uso.
- [x] 3.6 Fazer `subscribeThinkzapLine` e `unsubscribeThinkzapLine` recusarem quando os efeitos de provider estão desligados e gravarem `setBillingState('subscribed' | 'unsubscribed')` depois do sucesso, sem consultar a marca antes. Verificação: em `thinkzap-line-actions.test.ts`, provider ok → marca gravada; provider falha → marca não gravada; flag desligada → provider não chamado.
- [x] 3.7 Adicionar `providerBilling` em cada item de `listAppSubscriptions`, lido do espelho do recurso em lote, sem expor credencial. Verificação: teste com item `subscribed`, `unsubscribed` e sem espelho (`unknown`), e uma asserção de que `zApiInstanceToken` não aparece no payload.

## 4. Front: base compartilhada

- [x] 4.1 Atualizar `lib/portal-domains.ts` com `mirror`, os indicadores do cliente, `PortalAppDetail`, `providerBilling` e os tipos de resposta das ações. Verificação: `yarn tsc --noEmit` no front.
- [x] 4.2 Criar `lib/portal-status.ts` com o mapa de status de assinatura, de instalação e de espelho → tom do `AdminStatusBadge` + chave de i18n. Verificação: teste unitário cobrindo todo valor dos enums (nenhum cai em valor cru).
- [x] 4.3 Adicionar as chaves de i18n em `messages/{pt,en,es}/admin/clients.json`, `client-detail.json` e `app-settings.json`: rótulos de status, estados, ações, confirmações e motivos de erro. Verificação: o teste de paridade de chaves de i18n do projeto (ou um script equivalente) passa nos três idiomas.

## 5. Front: listagem de clientes

- [x] 5.1 Refazer `admin-clients-page.tsx`:
  - `AdminPageHeader` com o total;
  - busca por domínio ou member id;
  - filtro por app code e filtro "Com pendência de espelho";
  - paginação de 25;
  - estados de carregamento (skeleton do tamanho da tabela), vazio com "Limpar filtros" e erro com `AdminEmptyState`.

  Verificação: teste unitário da função de filtro e paginação, e um teste de componente para "nenhum resultado → Limpar filtros".
- [x] 5.2 Refazer `admin-clients-table.tsx`:
  - tabela a partir de `md` e cards abaixo de `md`;
  - linha navegável por teclado;
  - badge de espelho só quando ele não está `linked`.

  Verificação: a 375px não há rolagem horizontal, e Tab + Enter abre o detalhe (checagem no navegador).

## 6. Front: detalhe do cliente

- [x] 6.1 Refazer `admin-client-detail-page.tsx`:
  - cabeçalho com breadcrumb e "Abrir portal";
  - fileira de `AdminStatCard` com o aviso de incompleto;
  - painel de identificação;
  - grade de cards de aplicação, com status, espelho, e-mail, data e resumo do contrato nos quatro estados, todos levando ao detalhe da aplicação;
  - "Cliente não encontrado" para `404`.

  Verificação: teste de componente cobrindo `no-mirror`, `unavailable`, sem assinatura e com assinatura, e checagem visual no navegador em desktop e 375px.

## 7. Front: detalhe da aplicação

- [x] 7.1 Transformar `admin-app-settings-page.tsx` em `admin-app-detail-page.tsx`:
  - lê `GET /portal/apps/:appId`;
  - cabeçalho com breadcrumb, título, app code, status e espelho;
  - abas Visão geral, Assinaturas, Linhas (só ThinkZap) e Técnico (só ThinkZap, colapsado);
  - aba sincronizada com `?aba=`;
  - a rota `[appId]/page.tsx` passa a usar o novo componente.

  Verificação: abrir `?aba=assinaturas` abre a aba certa, e o app Extrator não mostra Linhas nem Técnico.
- [x] 7.2 Criar a aba Visão geral: dados da instalação, estado do espelho com o texto de impacto, resumo do contrato e o botão "Vincular espelho" para `no-mirror` e `mirror-missing`, que mostra o motivo traduzido em `409` (inclusive a lista de ids em `ambiguous`) e recarrega a tela em sucesso. Verificação: teste de componente com sucesso e com `ambiguous`.

## 8. Front: aba Assinaturas e ações

- [x] 8.1 Refazer `admin-app-subscriptions-section.tsx`:
  - um card por assinatura (badge de status, modalidade, plano/produto, período em UTC, gateway);
  - linhas com o provider, o status do item e `providerBilling`;
  - estados sem espelho, vazio e erro com "Tentar de novo".

  Verificação: teste de componente para os quatro estados.
- [x] 8.2 Adicionar as ações da assinatura:
  - "Ativar", com um diálogo que pede o novo fim de período quando o período terminou;
  - "Inativar", com uma confirmação que mostra quantas linhas serão desassinadas;
  - "Assinar todas no provider", com toast de resultado e contagens;
  - em assinatura Stripe, Ativar e Inativar ficam ocultos, com o texto explicativo;
  - um `busy` por assinatura;
  - releitura depois de cada ação.

  Verificação: testes de componente com Stripe sem ações, falha parcial mostrando as contagens e uma segunda ação bloqueada enquanto a primeira roda.
- [x] 8.3 Adicionar as ações por linha "Assinar no provider" e "Desassinar no provider" (esta com confirmação explicando que o próximo UPDATE do item pode reassinar). Linha sem credencial fica desabilitada com o motivo, e `provider-effects-disabled` aparece como ação desabilitada. Verificação: teste de componente para linha sem credencial e para a recusa por ambiente.
- [x] 8.4 Remover da aba Linhas (`admin-client-instances-section.tsx`) as ações de subscribe e unsubscribe que passaram para Assinaturas, mantendo renomear, reativar e configurar. Verificação: os testes existentes da seção continuam passando, e as ações de provider aparecem só na aba Assinaturas.

## 9. Verificação integrada

- [ ] 9.1 Rodar `yarn test` e `yarn lint` em `api/` e `front/`. Verificação: os dois verdes.
- [ ] 9.2 Em homologação, no navegador:
  - percorrer listagem → cliente → aplicação → assinaturas;
  - conferir que ativar, inativar e as ações de provider aparecem desabilitadas com o motivo;
  - vincular o espelho de uma instalação `no-mirror` de teste.

  Verificação: os passos registrados com prints no PR.
- [ ] 9.3 Em produção, depois do deploy, com uma assinatura manual de teste do portal interno:
  - inativar e conferir `Cancelado` na SPA 1142 e as linhas desassinadas no provider;
  - ativar com um novo fim de período e conferir `Ativo` e as linhas reassinadas.

  Verificação: o resultado registrado no PR.
- [x] 9.4 `openspec validate backoffice-clientes-aplicacoes --strict` sem erros.
