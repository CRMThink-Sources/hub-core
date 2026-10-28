# Design

## Context

A motivação está em `proposal.md`. O estado atual que molda a abordagem:

- **Varredura.** `ExpireSubscriptions` (`modules/application/application/expire-subscriptions.ts`) recebe do `BitrixExpiringSubscriptionLister` as assinaturas `trialing`/`active` com período vencido, decide com `resolveExpiredSubscriptionStatus` e grava `{ status }` uma a uma. Cada assinatura tem o seu `try/catch`, e uma pausa do Bitrix encerra a rodada. `RunSubscriptionExpiration` envolve a varredura com o histórico (`begin`/`complete`). `startSubscriptionExpirationJob` agenda `0 * * * *` com lock no Redis (TTL de 55 min) e apaga o histórico com mais de 90 dias.
- **Cobrança por linha.** A regra está toda em `resolveProviderBillingAction` (`modules/thinkzap/application/helpers/resolve-provider-billing-action.ts`): pai `cancelled` desassina, item `cancelled` desassina, item `active` sob pai `active` sem marca assina. `SyncSpaItemResourceStatus` aplica a regra a um item: lê o item cru, resolve a credencial, consulta o espelho e chama `ProviderResourceBilling.subscribeResource`/`unsubscribeResource`. `SyncSubscriptionLinesBilling` faz o mesmo para todos os itens de uma assinatura.
- **Espelho.** As marcas `subscribedAt`/`unsubscribedAt` ficam no Redis, sem TTL (`redis-spa-item-resource-mirror.repository.ts`). Desassinar limpa a marca de assinado.
- **Providers.**
  - O `subscribe` da Z-API engole `ALREADY_ACTIVE` e o da HubMessage engole `ALREADY_PAID`. Hoje os dois devolvem `void`, então quem chama não sabe se assinou agora.
  - O `unsubscribe` da Z-API **agenda** o cancelamento para o fim do período pago (`due`).
- **Flags.** `env.payments.expiration.enabled` vem de `SUBSCRIPTION_EXPIRATION_ENABLED` e, sem valor, cai em `providerEffectsEnabled`. Por isso um `true` explícito liga a varredura mesmo com os efeitos de provider desligados.
- **SPA 1142.** Já tem `ufCrm91CanceledAt` no `crm.item.fields`, mas nada grava esse campo. Não tem campo de data de vencimento.
- **Histórico.** As tabelas `core_subscription_expiration_runs` e `core_subscription_expiration_changes` guardam só mudanças de status (`to_status` em texto).

## Goals / Non-Goals

**Goals:**
- Uma rodada horária faz, nesta ordem: expiração (como hoje), data de vencimento, desassinatura do dia 5 e cancelamento do dia 10. Uma vez por dia, também a reconciliação.
- A regra de "o que fazer com a linha" continua num lugar só (`resolveProviderBillingAction`), e não duplicada no job.
- Tudo é idempotente por rodada: rodar duas vezes no mesmo dia não chama o provider de novo para o que já foi feito.

**Non-Goals:**
- Assinaturas Stripe nas regras de 5 e 10 dias (change C).
- Ler do provider o estado de assinatura. O `subscribe` idempotente é a verificação.
- Um job separado para a reconciliação no catálogo. É a mesma rodada, marcada com `reconciliation`.
- Notificar o cliente antes de desassinar ou cancelar.

## Decisions

### D1. Uma rodada, cinco etapas em sequência

`ExpireSubscriptions` vira `VerifySubscriptions`, com as etapas em ordem:

```
  1. expirar          trialing -> trial_expired ; active manual -> past_due (+ pastDueAt = hoje)
  2. datar            past_due manual sem pastDueAt -> pastDueAt = hoje
                      qualquer status != past_due com pastDueAt -> limpar
  3. dia 5            past_due manual, hoje >= pastDueAt + 5 -> desassinar linhas      [provider]
  4. dia 10           past_due manual, hoje >= pastDueAt + 10 -> cancelled + canceledAt
  5. reconciliar      (só na janela diária ou manual) linhas active de assinaturas active -> subscribe   [provider]
```

- A ordem 3 → 4 garante que, no dia 10, a assinatura já tentou desassinar as linhas. A etapa 4 não depende do sucesso da 3: se uma linha falhou, o ciclo de cancelamento (`SyncSubscriptionLinesBilling`, disparado pelo UPDATE da 1142) a desassina.
- Cada etapa tem `try/catch` por item, e a pausa do Bitrix interrompe a rodada inteira (`paused = true`), como hoje.
- A etapa 1 grava `pastDueAt` junto com o status, numa só escrita. Por isso uma assinatura recém-vencida não passa pela etapa 2.
- Os dias são de calendário, no mesmo fuso de `formatCalendarDate`/`resolveLineEntitlement`. `pastDueAt` é guardado como dia (`toSpaCalendarDateValue`), igual a `currentPeriodEnd`.
- Uma função pura nova, `resolvePastDueAction(subscription, today)`, devolve `'stamp' | 'unsubscribe-lines' | 'cancel' | null`. É testada como `resolveExpiredSubscriptionStatus`.

*Alternativa:* um job novo só para os dias 5 e 10. Rejeitada: seriam dois locks e duas rodadas mexendo na mesma assinatura, e o usuário quer "a verificação" como um job só.

### D2. Listagem: dois cortes na SPA 1142 e um na SPA 1146

- O `BitrixExpiringSubscriptionLister` continua para a etapa 1.
- Um novo `listPastDueManual()` (status `past_due`) alimenta as etapas 2 a 4. O filtro de modalidade é feito na aplicação, porque modalidade vazia conta como manual.
- Um novo `listWithStalePastDueAt()` (status diferente de `past_due` e `ufCrm91PastDueAt` preenchido) alimenta a limpeza. O filtro de campo não vazio no `crm.item.list` precisa ser confirmado na task 2.3. Se o Bitrix não aceitar, a alternativa é listar por `>ufCrm91PastDueAt: 2000-01-01`.
- Reconciliação: uma passada paginada nas assinaturas `active` (ids), outra nos itens `active` da SPA 1146, e o cruzamento pelo parent fica em memória. Isso evita N chamadas `listSubscriptionItemIds`. As duas listagens pedem só os campos necessários.

Todos os listers paginam pelo `next`, como o atual.

### D3. A regra de cobrança ganha um `mode`, e não um caminho paralelo

`resolveProviderBillingAction` passa a receber `mode: 'event' | 'past-due-expired' | 'reconcile'`. O padrão é `'event'`, que mantém o comportamento atual.

```
mode 'past-due-expired': item com credencial, sem marca de desassinado -> unsubscribe (reason 'parent-past-due-expired')
                         com marca                                     -> noop in-sync
mode 'reconcile':        item active, pai active                       -> subscribe (ignora a marca de assinado)
                         qualquer outro                                -> noop
```

`SyncSpaItemResourceStatus.execute` recebe `mode` (e `parentStatus`, que já existe) e passa a devolver o resultado do provider na reconciliação: `'subscribed' | 'already-subscribed'`. A verificação chama esse caso de uso através de uma porta no módulo `application` (`SubscriptionLineBilling`), com o adaptador no `thinkzap`, pela mesma direção de dependência que os factories já usam.

`ProviderBillingOrigin` ganha `'subscription-past-due'`, com o motivo "Assinatura vencida há 5 dias", que a HubMessage recebe no `cancelReason`.

*Alternativa:* chamar `ProviderResourceBilling` direto do job. Rejeitada porque duplicaria a leitura de credencial, o espelho e as marcas, que hoje vivem em `SyncSpaItemResourceStatus`.

### D4. O `subscribe` informa se já estava assinado

- `WhatsappConnectorProvider.subscribe` passa a devolver `Promise<'subscribed' | 'already-subscribed'>`.
- Z-API: o caminho de `isZApiAlreadySubscribed` devolve `'already-subscribed'`.
- HubMessage: tanto o erro `ALREADY_PAID` quanto o corpo `200 { type: 'ALREADY_PAID' }` devolvem `'already-subscribed'`.
- Quem hoje ignora o retorno continua funcionando, porque o tipo é compatível com `await`.

### D5. Campo "Vencido em" com código fixo

O campo foi criado à mão no portal em 28/10/2026, com o código estável `UF_CRM_91_PAST_DUE_AT` (`ufCrm91PastDueAt` no `crm.item.*`) e o rótulo "Vencido em". O tipo é `datetime`, igual a `ufCrm91CurrentPeriodEnd` e `ufCrm91CanceledAt`. Por isso ele é lido e gravado como dia de calendário pelos mesmos helpers (`toSpaCalendarDateValue` e a âncora em UTC), e não como instante.

O mapper ganha `pastDueAt?: Date | null` na leitura e na escrita (`null` limpa) e `canceledAt` na escrita.

### D6. Gate de ambiente para as etapas de provider

As etapas 3 e 5 rodam só se `env.payments.spa.providerEffectsEnabled` está ligado. Quando não está, a rodada grava `providerStepsSkipped = true` e segue com as etapas 1, 2 e 4.

O cancelamento do dia 10 (etapa 4) também é escrita na SPA compartilhada, mas ele já depende de `SUBSCRIPTION_EXPIRATION_ENABLED`, como a etapa 1. O UPDATE que ele dispara chega aos dois ambientes, e cada um respeita a própria flag de provider, como já acontece hoje.

### D7. Janela diária da reconciliação

- A rodada agendada inclui a reconciliação quando a hora local do portal é ≥ `SUBSCRIPTION_RECONCILE_HOUR` (padrão `3`) **e** não existe rodada com `reconciliation = true` iniciada hoje.
- A consulta é ao histórico (`runs.hasReconciliationSince(startOfToday)`). Assim, uma rodada das 03:00 que falhou ou que o processo perdeu é coberta pela das 04:00.
- O "Rodar agora" sempre inclui a reconciliação.

*Alternativa:* um cron separado `0 3 * * *`. Rejeitada porque perde a recuperação automática quando a rodada das 03:00 cai.

### D8. Histórico: colunas novas, com valor padrão

Migration aditiva, sem reescrever linhas antigas:

| Tabela | Colunas novas |
|---|---|
| `core_subscription_expiration_runs` | `lines_unsubscribed`, `cancelled`, `lines_checked`, `lines_subscribed` (int, default 0); `reconciliation`, `provider_steps_skipped` (bool, default false) |
| `core_subscription_expiration_changes` | `kind` (texto, default `'status'`: `status` / `line-unsubscribed` / `line-subscribed`); `item_id` e `provider` (nullable); `to_status` e `from_status` passam a nullable |

O filtro "só com alterações" passa a considerar também os contadores novos. A API de rodadas devolve os campos novos, e o front os trata como opcionais, para conviver com um deploy de API anterior.

### D9. Front

- No registro de jobs: nome "Verificação de assinaturas", periodicidade "A cada hora · reconciliação diária".
- A tabela de rodadas troca "Verificadas" por colunas agrupadas: Status (expirados/vencidas/canceladas), Linhas (desassinadas/assinadas) e Falhas. Os números ficam empilhados por célula, para a tabela não passar de 8 colunas. Rodadas com reconciliação levam uma marca.
- O drawer da rodada agrupa as ações por tipo e linka o item da SPA 1146.
- O aviso informativo passa a descrever as regras dos dias 5 e 10.
- O diálogo "Rodar agora" avisa que a rodada pode desassinar e cancelar.

## Risks / Trade-offs

- **[Z-API: subscribe depois de cancelamento agendado]** Testado em 28/10/2026 (task 1.1) numa instância criada para isso (`3FB5041A…`):
  - o `unsubscribe` deixa a instância em `CANCELLATION_PROCESS` com o `due` mantido;
  - o `subscribe` seguinte responde `200 { subscriptionStatus: "PROCESSING" }`, e não `ALREADY_ACTIVE`;
  - cerca de 15 s depois, a instância está `PAID`, com o mesmo `due`.

  **O subscribe desfaz o cancelamento agendado**, então a reativação pós-vencimento funciona pelo fluxo existente e o design não muda. Consequências:
  - para D4, uma instância em `CANCELLATION_PROCESS` responde `PROCESSING`, e o resultado é contado como "assinou agora". É o certo, porque ela ia cair no `due`;
  - o efeito é assíncrono (segundos), então ler o `paymentStatus` logo depois do subscribe não serve como confirmação.
- **[Primeiro deploy cancela muita coisa de uma vez]** Todas as manuais `Vencido` antigas recebem "hoje" na primeira rodada. Em 5 dias, todas são desassinadas juntas. → Mitigação: o time recebe, antes do deploy, a lista de manuais `Vencido` com o fim do período para regularizar quem for cliente ativo de fato (task 7.1). O volume é pequeno: 3 hoje no portal.
- **[Marca de desassinado sem TTL e reativação manual]** Uma assinatura reativada à mão volta a assinar pelo fluxo de reativação existente, que troca as marcas. Já está coberto por "Reativar a assinatura cancelada reassina as linhas ativas", que vale para qualquer pai `active`.
- **[Volume da reconciliação]** São N linhas × 1 chamada por dia por provider. → Mitigação: a chamada é sequencial, com o limitador de Bitrix só nas leituras. Os providers não têm limite documentado que preocupe nesse volume (dezenas de linhas).
- **[Duas escritas por rodada na mesma assinatura]** Não acontece. Cada assinatura cai em uma etapa por rodada (vencer, datar, desassinar ou cancelar), porque as condições são mutuamente exclusivas pelo número de dias.

## Migration Plan

1. Campo `UF_CRM_91_PAST_DUE_AT` no portal: já criado em 28/10/2026. O portal é compartilhado, então não há passo por ambiente.
2. Fazer o deploy da API com a migration, que é aditiva. Os fronts antigos ignoram os campos novos.
3. Fazer o deploy do front.
4. Rollback: reverter o deploy da API faz o job voltar ao comportamento antigo. O campo e as colunas novas ficam sem uso, sem efeito colateral. As linhas já desassinadas continuam desassinadas, e reassinar é mudar a assinatura para `Ativo` no CRM.
