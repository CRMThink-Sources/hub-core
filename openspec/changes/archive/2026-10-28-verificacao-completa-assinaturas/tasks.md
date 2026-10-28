# Tasks

## 1. Pré-requisitos

- [x] 1.1 Testar numa instância Z-API de homologação: `unsubscribe` (cancelamento agendado para o `due`) seguido de `subscribe` antes do `due`. Registrar a resposta de cada chamada e o `due` e status da instância depois. Verificar e anotar o resultado em `design.md` (Risks). Se o cancelamento continuar agendado, pausar a implementação e atualizar o design com a chamada que reverte.
- [x] 1.2 Garantir que o change `identidade-visual-portal-admin` foi arquivado (`/opsx:archive`). Verificar com `openspec validate verificacao-completa-assinaturas --strict` sem o aviso de `portal-admin/catalogo-jobs`.
- [x] 1.3 Criar o campo `UF_CRM_91_PAST_DUE_AT` ("Vencido em") na SPA 1142. Feito à mão no portal; verificado em `crm.item.fields`: `ufCrm91PastDueAt`, tipo `datetime`, igual aos outros campos de data da SPA.

## 2. Leitura e escrita da SPA 1142

- [x] 2.1 Acrescentar `pastDueAt` ao recorte de leitura da varredura (`ExpirableSubscription` e o schema dele) e `pastDueAt`/`canceledAt` à escrita do `subscription.mapper.ts` (`null` limpa; `toSpaCalendarDateValue`). A entidade `Subscription`, que tem cache, não precisa do campo, então a versão do cache não sobe. Verificar com os testes do mapper cobrindo ler, gravar e limpar.
- [x] 2.2 Criar `listPastDueManual()` (status `past_due`; modalidade vazia conta como manual), paginado pelo `next`, com `select` mínimo (`id`, status, modalidade, `ufCrm91PastDueAt`, `ufCrm91CurrentPeriodEnd`). Verificar com teste no padrão de `bitrix-expiring-subscription.lister.test.ts`.
- [x] 2.3 Criar `listWithStalePastDueAt()` (status diferente de `past_due` e "Vencido em" preenchido). Confirmar contra o portal qual filtro do `crm.item.list` seleciona campo de data não vazio e registrar no código. Verificar com teste unitário e uma chamada real que devolve a assinatura de teste.
- [x] 2.4 Criar os listers da reconciliação: ids de assinaturas `active` na 1142 e itens `active` da 1146 com parent e credencial, paginados. Verificar com teste de paginação e de cruzamento por parent.

## 3. Regra de vencimento

- [x] 3.1 Criar `resolvePastDueAction(subscription, today)` em `domain/subscription-expiration.ts`, devolvendo `'stamp' | 'unsubscribe-lines' | 'cancel' | null` (Stripe → `null`). Verificar com testes dos cenários de 03/11 da spec: dia 4, dia 5, dia 10, sem data e Stripe.
- [x] 3.2 Fazer a etapa 1 gravar `pastDueAt = hoje` junto com `past_due`. Verificar com o teste de `ExpireSubscriptions` "manual vencida grava status e data numa escrita".

## 4. Cobrança por linha (thinkzap)

- [x] 4.1 Fazer o `subscribe` de `WhatsappConnectorProvider`, Z-API e HubMessage devolver `'subscribed' | 'already-subscribed'`, cobrindo `ALREADY_PAID` como erro e como corpo 200. Verificar estendendo `provider-already-subscribed.test.ts` e os testes dos clients.
- [x] 4.2 Acrescentar `mode` (`event` | `past-due-expired` | `reconcile`) a `resolveProviderBillingAction` e a razão `parent-past-due-expired`. O padrão `event` não muda nada. Verificar com o teste existente intacto e casos novos para cada modo.
- [x] 4.3 Propagar `mode` por `SyncSpaItemResourceStatus` e devolver `already-subscribed` na reconciliação. Adicionar a origem `subscription-past-due` com o motivo "Assinatura vencida há 5 dias". Verificar com testes: desassina sem marca, não repete com marca, reconcilia ignorando a marca de assinado e grava a marca nos dois retornos.
- [x] 4.4 Criar a porta `SubscriptionLineBilling` em `modules/application/domain` e o adaptador no thinkzap (`unsubscribeLinesForPastDue(subscriptionId)`, `reconcileLine(item, parentStatus)`), com falha isolada por item e resultado por linha (item, provider, resultado, erro). Verificar com teste do adaptador com uma linha falhando.

## 5. Verificação e histórico

- [x] 5.1 Migration aditiva (D8) e atualização de `SubscriptionExpirationRun`/`Change` e do repositório Prisma (`finish`, `list`, `findById`, filtro "só com alterações" com os contadores novos, `hasReconciliationSince`). Verificar com `prisma migrate dev` local e os testes do repositório, incluindo uma rodada antiga lida com contadores novos em zero.
- [x] 5.2 Transformar `ExpireSubscriptions` em `VerifySubscriptions` com as 5 etapas de D1, a pausa do Bitrix interrompendo tudo e `try/catch` por item. Verificar com testes: rodada só com expiração; datar e limpar; dia 5 com uma linha falhando; dia 10 sem chamar provider; pausa no meio da etapa 3.
- [x] 5.3 Aplicar o gate de provider (D6): sem `env.payments.spa.providerEffectsEnabled`, pular as etapas 3 e 5 e marcar `providerStepsSkipped`. Verificar com o teste do cenário "Verificação ligada e provider desligado".
- [x] 5.4 Implementar a janela diária (D7) em `RunSubscriptionExpiration`/job, com `SUBSCRIPTION_RECONCILE_HOUR` (padrão 3) em `config/env.ts`, e o "Rodar agora" sempre reconciliando. Verificar com testes do job: 02:00 não reconcilia; 03:00 reconcilia; 04:00 depois de uma rodada das 03:00 com reconciliação não reconcilia; 04:00 sem rodada das 03:00 reconcilia; manual reconcilia.
- [x] 5.5 Expor os campos novos na API de rodadas (lista e detalhe, com `crmUrl` do item da 1146 nas ações de linha). Verificar com os testes dos controllers de rodadas.

## 6. Backoffice

- [x] 6.1 Atualizar o registro de jobs (nome "Verificação de assinaturas", periodicidade) e os tipos de `lib/subscription-expiration-runs.ts`, com campos novos opcionais. Verificar com `lib/admin-jobs.test.ts` e `check-types`.
- [x] 6.2 Atualizar a tabela de rodadas (D9: colunas agrupadas, marca de reconciliação, provider pulado), o aviso informativo e o texto do diálogo "Rodar agora". Verificar no navegador com uma rodada antiga e uma nova.
- [x] 6.3 Agrupar o drawer da rodada por tipo de ação, com item, provider e link para a 1146. Verificar no navegador com uma rodada que desassinou linhas (dados de teste locais).
- [x] 6.4 Atualizar `messages/{pt,en,es}/admin/jobs.json`. Verificar que não falta chave em nenhum dos três idiomas.

## 7. Integração e rollout

- [x] 7.1 Gerar para o time a lista de assinaturas manuais `Vencido` hoje no portal (id, cliente, fim do período), para regularizar antes do deploy. Verificar com a lista entregue.
- [x] 7.2 Rodar `yarn lint`, `yarn check-types` e `yarn test` na `api` e `npm run lint`, `npm run check-types` e `npm test` no `front`. Verificar que tudo passa.
- [ ] 7.3 Em homologação com provider desligado, disparar "Rodar agora" com uma assinatura manual de teste `Vencido` com "Vencido em" de 6 dias atrás. Verificar que a rodada registra "provider pulado" e nada é chamado no provider.
- [x] 7.4 Rodar `openspec validate verificacao-completa-assinaturas --strict` sem erros.
