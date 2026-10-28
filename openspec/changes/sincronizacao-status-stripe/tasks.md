# Tasks

## 1. Aplicação de estado do gateway (comum ao webhook e ao job)

- [x] 1.1 Extrair `applyStatus`/`applyCancellation` de `HandleGatewayWebhookEvent` para `ApplyGatewaySubscriptionState`, sem mudar comportamento. O webhook passa a delegar a ele. Verificar com os testes atuais de `handle-gateway-webhook-event` passando sem alteração.
- [x] 1.2 Fazer `applyUpdate` e `applyCancellation` devolverem o resultado por assinatura (D1). Para isso, `ProviderResourceBilling.unsubscribe` passa a informar `{ ok, provider }` por linha. Verificar com testes novos de `ApplyGatewaySubscriptionState`: já concorda (`unchanged`), atualiza status e período, cancela e desassina duas linhas, falha ao gravar o cancelamento sem desassinar, e id do gateway sem assinatura na SPA.

## 2. Leitura no Stripe e na SPA

- [x] 2.1 Adicionar `readSubscriptionState(gatewayId)` à porta do gateway e ao `StripePaymentGateway` (D2), com o mapa de decisão, `null` para status fora do mapa, `not-found` para `resource_missing` e a soma de quantidades. Verificar com testes do gateway com o client Stripe falso: ativo, `canceled`, status desconhecido, 404 e erro de rede (lança).
- [x] 2.2 Criar `listStripeSubscriptions()` na SPA 1142 (modalidade `stripe`, `select` mínimo, paginado), devolvendo id, id do gateway e ambiente. Verificar com teste de paginação e de filtro.

## 3. Sincronização e histórico

- [x] 3.1 Migration das tabelas `core_stripe_sync_runs` e `core_stripe_sync_changes` (D4), entidade, porta e repositório Prisma com `start`/`finish`/`fail`/`list`/`findById`/`deleteStartedBefore`. Verificar com `prisma migrate deploy` local e testes do repositório no padrão do da verificação.
- [x] 3.2 Criar o caso de uso `SyncStripeSubscriptions`:
  - seleção por ambiente (vazio conta como produção) e agrupamento por id do gateway;
  - leitura no Stripe;
  - `applyUpdate`/`applyCancellation`;
  - registro de `not-found` e `unknown-status`;
  - falha isolada por id do gateway;
  - pausa do Bitrix encerrando a rodada.

  Verificar com testes cobrindo os cenários da spec `pagamentos/sincronizacao-stripe`.
- [x] 3.3 Criar `RunStripeSync`, `StartManualStripeSync`, o lock Redis próprio e `startStripeSyncJob` (`30 * * * *`, limpeza de 90 dias), e registrar o job no boot da API. Verificar com testes do job no padrão de `subscription-expiration.job`: desligado não agenda; sem lock não registra.
- [x] 3.4 Adicionar `STRIPE_SYNC_ENABLED` ao `env.ts`, com o padrão de D5, e documentar no `api/.env.example`. Verificar com teste do parser: `true`/`false` explícitos; ausente com chave de teste desligado; ausente com chave live e provider ligado ligado.
- [x] 3.5 Criar as rotas do portal `GET /portal/stripe-sync/runs`, `GET /portal/stripe-sync/runs/:id` e `POST /portal/stripe-sync/runs`, com sessão do portal e links da SPA 1142/1146 no detalhe. Verificar com testes dos controllers: `401` sem sessão, `404` para rodada inexistente e `409` desligado/ocupado.

## 4. Backoffice

- [x] 4.1 Criar `lib/stripe-sync-runs.ts` (tipos e chamadas) e a entrada `sincronizacao-stripe` no registro de jobs. Verificar com testes no padrão de `subscription-expiration-runs.test.ts` e `admin-jobs.test.ts`.
- [x] 4.2 Criar a página `AdminStripeSyncJobPage` (D7) e registrá-la em `admin-job-pages.tsx`. Verificar no navegador com rodadas de teste locais: tabela, painel agrupado e "Rodar agora" (que responde desligado localmente).
- [x] 4.3 Adicionar as chaves `admin/jobs` do job novo nos três idiomas. Verificar que não falta chave em nenhum idioma.

## 5. Integração

- [x] 5.1 Rodar lint, tipos e testes da `api` e do `front`. Verificar que tudo passa (exceto falhas já existentes e sem relação, que devem ser listadas).
- [ ] 5.2 Rodar uma sincronização em produção pelo "Rodar agora" depois do deploy. Verificar o resultado no detalhe da rodada: as assinaturas `not-found` (se houver) são as de ambiente vazio que são de teste, e nenhuma `homolog` foi lida.
- [x] 5.3 Rodar `openspec validate sincronizacao-status-stripe --strict` sem erros.
