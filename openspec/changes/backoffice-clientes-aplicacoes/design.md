# Design

## Context

O que existe hoje (ver proposal.md, seção Why, para a motivação):

- **Identidade da instalação.** Fica em `core_domains`/`core_apps` (`PrismaPortalDomainReadRepository`). A SPA 1060 entra de duas formas:
  - o título, via `hydrateAppTitles` → `BitrixAplicationTitleReader.getTitlesBySpaIds`, em lotes de 50;
  - o contrato, via `hydrateAppContracts`, só no detalhe do cliente.
- **Leitor de títulos.** `BitrixAplicationTitleReader` captura a falha **por lote** dentro de `collectBatch`. Quem chama não consegue distinguir "item não existe" de "lote falhou". A integridade do espelho depende dessa distinção.
- **Status da instalação.** `core_apps.status` (enum `ACTIVE|INACTIVE|SUSPENDED|TRIAL`) é gravado na instalação e nunca mais muda. Não existe tratamento de desinstalação.
- **Aba Assinaturas.** `GET /portal/apps/:appId/subscriptions` (`listAppSubscriptions`) já lê as SPAs 1142/1146 via `GetAplicationContext`. O `AdminAppSubscriptionsSection` existe, mas o `TabsTrigger` dele foi removido de `admin-app-settings-page.tsx`.
- **Ações por linha.** `subscribe-thinkzap-line.ts` e `unsubscribe-thinkzap-line.ts` chamam Z-API/HubMessage direto. Elas **não gravam a marca** do espelho do recurso (`SpaItemResourceMirrorRepository`) e **não olham** `THINKZAP_SPA_PROVIDER_EFFECTS_ENABLED`.
- **Ciclo da SPA 1142.** O UPDATE da SPA 1142 já enfileira `SyncSubscriptionLinesBilling`, que roda `SyncSpaItemResourceStatus` por item com o status do pai. A regra, a marca e a idempotência ficam ali.
- **Escrita na SPA 1142.** `SubscriptionRepository.updateSubscription` com `UpdateSubscriptionInput` (status, período, `pastDueAt`, `canceledAt`), a mesma usada pela verificação de assinaturas.
- **UI.** O portal já tem `AdminPageHeader` (com breadcrumb), `AdminPanel`, `AdminStatusBadge`, `AdminStatCard` e `AdminEmptyState` em `components/layouts/admin/ui/`, além dos tokens `status-*` do tema.

## Goals / Non-Goals

**Goals:**
- Reaproveitar o ciclo da SPA 1142 em vez de chamar o provider a partir de ativar ou inativar.
- Uma fonte para a regra de "assinar todas": `SyncSubscriptionLinesBilling`, chamado de forma síncrona.
- Integridade do espelho sem custo extra por linha da listagem: o mesmo lote que já busca os títulos.
- Usar só os componentes `admin/ui` e os tokens do tema, sem cor crua nova.

**Non-Goals:**
- Tratar a desinstalação ou atualizar `core_apps.status`. Isso depende do diagnóstico e fica para outro change.
- Criar item na SPA 1060 a partir do backoffice ("recriar espelho"). "Vincular" só religa um item que já existe.
- Ativar ou inativar no Stripe a partir do backoffice.
- Paginação no servidor. O volume atual de domínios cabe numa leitura, e o filtro roda no cliente.
- Editar plano, período ou itens da assinatura, fora o novo fim de período ao ativar.

## Decisions

### D1. Integridade do espelho no leitor de títulos
Nova porta `AplicationMirrorReader` (estende `AplicationTitleReader`, para não quebrar os fakes existentes), implementada pelo `BitrixAplicationTitleReader`. O método `getMirrorsBySpaIds(spaIds)` devolve `{ titles, existing, unverified }`: `existing` são os ids que a SPA devolveu (com ou sem título) e `unverified` os ids dos lotes que falharam. O estado sai daí:
- `spa_id` nulo → `no-mirror`;
- id em `unverified` → `unknown`;
- id presente em `existing` → `linked` (item sem título também existe);
- os demais → `mirror-missing`.

`hydrateAppTitles` vira `hydrateAppMirrors` e preenche `mirror` em cada app. O `getTitlesBySpaIds` antigo continua delegando a ele, para os outros chamadores.

*Alternativa descartada:* uma chamada `crm.item.get` por app. Seria uma ida ao Bitrix por linha da listagem, exatamente o que o comentário de `hydrateAppTitles` proíbe.

### D2. Detalhe da aplicação: novo endpoint
`GET /portal/apps/:appId` (`GetPortalAppDetail`). Ele lê a instalação com o domínio em `core_apps` e hidrata título e espelho com D1. Hoje a página de app não tem cabeçalho porque não existe essa leitura. Reaproveitar `GET /portal/domains/:id` traria os contratos de todas as apps só para montar um cabeçalho.

### D3. Vincular espelho: busca extraída do backfill
A busca (domínio normalizado + `APP_CODE = appCodeId`) sai de `scripts/backfill-aplication-spa-id.ts` para uma função de aplicação, `findAplicationSpaItems(domain, appCodeId)`. O script e o novo `LinkAplicationMirror` passam a usá-la. O caso de uso:
1. recusa se a instalação está `linked`;
2. busca os itens;
3. 0 → `not-found`; mais de 1 → `ambiguous`;
4. se `getAplicationBySpaId(item)` já aponta para outra instalação → `taken`;
5. senão, grava o `spa_id` com o mesmo `PrismaAplicationRepository` e invalida o cache da SPA 1060.

A constraint `@unique` de `spa_id` é a última barreira contra corrida. O `P2002` vira `taken`.

### D4. Ativar e inativar escrevem só na SPA
`ActivateSubscription` e `DeactivateSubscription` (módulo `portal`):
1. resolvem a assinatura e conferem que ela pertence à instalação: `subscription.aplication.spaId === app.spaId`, senão `404`;
2. recusam `stripe` com `gateway-managed`;
3. validam a transição;
4. chamam `updateSubscription`. Ativar grava `status: 'active'`, `pastDueAt: null` e o `currentPeriodEnd` opcional. Inativar grava `status: 'cancelled'` e `canceledAt: hoje`.

O UPDATE resultante dispara o webhook da SPA 1142, que enfileira `SyncSubscriptionLinesBilling`. É o mesmo caminho de quando o time edita a assinatura no CRM.

*Alternativa descartada:* chamar `SyncSubscriptionLinesBilling` logo depois da escrita. Haveria dois disparos (o síncrono e o do webhook). Seria idempotente por causa da marca, mas duplicaria logs e abriria uma corrida entre os dois.

O "fim do período obrigatório se o período já terminou" existe por causa da verificação de assinaturas: sem essa regra, ela marcaria `Vencido` de novo na rodada seguinte.

### D5. "Assinar todas" chama `SyncSubscriptionLinesBilling` de forma síncrona
O endpoint `subscribe-lines` executa o caso de uso na requisição, com um `traceKey` próprio do backoffice, e devolve `SyncSubscriptionLinesBillingResult`. O caso de uso lança quando alguma linha falha, para a fila retentar. Aqui um wrapper captura `SubscriptionLinesBillingError` e devolve a contagem com `failed > 0` em `200`. Retentar é decisão do operador.

Para "ignoradas" (`items - subscribed - unsubscribed - failed`), o caso de uso do portal calcula o campo. `SubscriptionLinesBillingError` passa a carregar o resultado da rodada (mudança aditiva), porque sem isso a falha parcial perderia as contagens das linhas que deram certo.

### D6. Ações por linha gravam a marca e respeitam o ambiente
`subscribeThinkzapLine` e `unsubscribeThinkzapLine` passam a:
- recusar com `ProviderEffectsDisabledError` (→ `409 provider-effects-disabled`) quando `env.payments.spa.providerEffectsEnabled` é falso;
- depois do sucesso no provider, gravar a marca com `SpaItemResourceMirrorRepository.setBillingState(itemId, 'subscribed' | 'unsubscribed')`, o mesmo método do ciclo. Espelho ausente é no-op, como no ciclo.

Elas continuam forçando a chamada, sem consultar a marca antes. A regra de "não chamar de novo" é do ciclo, não do suporte.

### D7. Estado no provider por linha na leitura
`AdminSubscriptionItemView` ganha `providerBilling: 'subscribed' | 'unsubscribed' | 'unknown'`, lido da marca do espelho do recurso (`SpaItemResourceMirrorRepository.find`, um GET no Redis por item). `unknown` quer dizer que não há marca (linha anterior ao backfill, ou nunca assinada por um caminho nosso) ou que a leitura do Redis falhou. Também ganha `hasCredential`, para a tela desabilitar ações sem expor a credencial, e a resposta ganha `providerEffectsEnabled`, para a tela mostrar as ações desabilitadas na homologação.

### D8. Front
- `lib/portal-domains.ts` ganha `mirror: 'linked' | 'no-mirror' | 'mirror-missing' | 'unknown'` em `PortalDomainApp`, o tipo `PortalAppDetail` e os tipos das ações.
- **Listagem.** `AdminPageHeader` + barra de busca e filtros + tabela (≥ `md`) ou cards (< `md`). Filtros e página ficam no estado local. Linha clicável com `<Link>` envolvendo o conteúdo da linha, para ter teclado e clique do meio de graça.
- **Detalhe do cliente.** `AdminPageHeader` com breadcrumb e ação "Abrir portal" (`https://{domain.name}`, `target=_blank rel=noopener`). Fileira de `AdminStatCard` e `AdminPanel` de identificação. Uma grade de cards de aplicação.
- **Detalhe da aplicação.** `admin-app-settings-page.tsx` vira `admin-app-detail-page.tsx`. A aba fica em `?aba=` (via `useSearchParams` + `router.replace`). As seções técnicas ficam como estão.
- **Assinaturas.** Um card por assinatura (`AdminPanel`) com um menu de ações. A confirmação usa o `Dialog` de `components/ui/dialog.tsx`. O resultado aparece num toast (o mesmo `sonner` do portal). Um `busy` por assinatura bloqueia ações concorrentes.
- **Rótulos dos status.** Um mapa único `subscriptionStatusTone` / `appStatusTone` / `mirrorTone` → `AdminStatusTone` + chave de i18n, em `lib/portal-status.ts`.

### D9. Script de diagnóstico
`scripts/diagnose-aplication-mirrors.ts`, só leitura. Ele imprime:
- instalações por estado de espelho (D1);
- itens da SPA 1060 sem instalação correspondente;
- grupos de itens duplicados por (domínio, app code);
- instalações por `status`.

Saída em tabela, mais `--json`. Ele roda em produção antes do deploy das telas, e o resultado é anexado ao change.

## Risks / Trade-offs

- **[A marca D6 diverge do ciclo]** O suporte desassina uma linha de uma assinatura ativa. O próximo UPDATE do item reassina, porque o item está `active`, a assinatura está ativa e a marca é de desassinado. → É o comportamento correto do ciclo. A UI explica no diálogo que, para parar de vez, é preciso cancelar o item ou a assinatura.
- **[O webhook da SPA 1142 não chega depois de ativar ou inativar]** → A aba recarrega e mostra o `providerBilling` real. O operador pode usar "Assinar todas no provider", que reconcilia nos dois sentidos.
- **[O backoffice da homologação escreve no CRM compartilhado]** → Ativar e inativar também são recusados com os efeitos de provider desligados (spec "Ações de provider respeitam o ambiente").
- **[`unknown` em massa quando o Bitrix cai]** → É intencional: "não verificado" não leva ninguém a vincular errado. O filtro "pendência de espelho" ignora `unknown`.
- **[Listagem toda em memória]** → Com centenas de domínios, cabe. Se crescer, a paginação no servidor entra sem mudar o contrato da UI.

## Migration Plan

1. Rodar `diagnose-aplication-mirrors.ts` em produção e registrar as contagens no change.
2. Deploy da API: endpoints novos, campo `mirror` aditivo e ações de linha com marca. Tudo compatível com o front atual.
3. Deploy do front.
4. Rollback: reverter o front. Os endpoints novos ficam sem uso. A gravação da marca nas ações de linha é um efeito correto e pode ficar.

## Open Questions

- Pelo resultado do diagnóstico: vale um change seguinte para a desinstalação (`core_apps.status`) e para recriar o espelho? Não altera este escopo.
