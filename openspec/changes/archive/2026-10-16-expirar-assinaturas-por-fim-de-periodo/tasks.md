# Tasks

## 1. Configuração

- [x] 1.1 Adicionar `env.payments.expiration` em `api/src/config/env.ts` com `enabled` (`SUBSCRIPTION_EXPIRATION_ENABLED`; se não existir, usa `providerEffectsEnabled`; só `'true'` e `'false'` explícitos sobrescrevem) e `manualGraceDays` (`MANUAL_SUBSCRIPTION_GRACE_DAYS`, inteiro `>= 0`, padrão `0`, inválido vira `0` com `warn`). Documentar as duas variáveis no `.env.example` ou equivalente. Verificar com teste unitário do parse: ausente, `0`, `3`, `-1`, `abc`.

## 2. Regra de expiração no domínio

- [x] 2.1 Criar a função pura `resolveExpiredSubscriptionStatus(subscription, now, manualGraceDays)`, que devolve `'trial_expired' | 'past_due' | null`, usando o mesmo corte de `resolveLineEntitlement` (`now > currentPeriodEnd`). Verificar com testes que cobrem: trial no último dia (`null`), trial vencido (`trial_expired`), manual vencida sem carência (`past_due`), manual dentro e depois da carência de 3 dias, Stripe vencida (`null`) e status `past_due`/`cancelled`/`trial_expired` (`null`).

## 3. Leitor das assinaturas candidatas

- [x] 3.1 Definir a porta `ExpiringSubscriptionLister` em `modules/application/domain`, que devolve `{ id, status, currentPeriodEnd, modality }[]`.
- [x] 3.2 Implementar `BitrixExpiringSubscriptionLister` em `modules/application/infra/bitrix/readers`. Ele filtra `ufCrm91Status` em `Em teste`/`Ativo` e `<=ufCrm91CurrentPeriodEnd` até a data de hoje, usa `select` mínimo e pagina por `next`. Reaproveita o mapa de status, `parseSpaCalendarDate`/`endOfCalendarDay` e a modalidade tolerante do `subscription.mapper.ts`, exportando o que for preciso sem duplicar os mapas. Item inválido é descartado com `warn`. Verificar com teste do leitor e um Bitrix falso: duas páginas são concatenadas, item com data inválida é ignorado, modalidade vazia vira `manual` e o filtro e o `select` enviados batem com o esperado.

## 4. Caso de uso

- [x] 4.1 Implementar `ExpireSubscriptions` em `modules/application/application/expire-subscriptions.ts`. Ele recebe o lister, o `SubscriptionRepository` e `manualGraceDays`, grava só `{ status }` via `updateSubscription` uma assinatura por vez, tem `try/catch` por item, registra em log um resumo `{ checked, trialExpired, pastDue, failed }` e deixa `BitrixMethodPausedError` encerrar a rodada. Verificar com testes usando fakes: grava `trial_expired` e `past_due` nos certos, não grava nos outros, a falha na primeira não impede a segunda, o patch contém só `status` e a pausa do Bitrix encerra a rodada.
- [x] 4.2 Criar a factory `makeExpireSubscriptions` em `modules/application/main`, montando o `CachedSubscriptionRepository` como as factories atuais fazem. Verificar compilando com `npm run build` (ou `tsc --noEmit`) dentro de `api/`.

## 5. Job agendado

- [x] 5.1 Criar `api/src/shared/infra/scheduler/subscription-expiration.job.ts` com `startSubscriptionExpirationJob()`. Ele usa `node-cron` a cada hora (`0 * * * *`) e o lock `subscription-expiration:tick` no Redis (TTL < 1h, liberado por script de comparação, como em `credential-refresh.job.ts`), e não agenda nada quando `env.payments.expiration.enabled` é `false`. Verificar com teste: com a flag desligada não agenda; com o lock ocupado pula a rodada; com o lock livre chama `execute` uma vez.
- [x] 5.2 Chamar `startSubscriptionExpirationJob()` em `api/src/app.ts`, ao lado de `startCredentialRefreshJob()`. Verificar subindo a API localmente e conferindo o log de agendamento (ou de "desligado" com a flag `false`).

## 6. Documentação e integração

- [x] 6.1 Atualizar os comentários de `Subscription.status` (`subscription.ts`) e de `DisconnectExpiredLine` ("A expiração é avaliada na leitura, não por job") para dizer que o produto agora grava `trial_expired`/`past_due` pelo job. Verificar relendo o diff.
- [x] 6.2 Rodar `npm test` em `api/` e confirmar que a suíte inteira passa.
- [ ] 6.3 Validação manual em homolog com a flag ligada de propósito, numa assinatura de teste: um trial com fim ontem vira `Teste expirado`, e uma manual `Ativo` com fim ontem (carência `0`) vira `Vencido` sem nenhum unsubscribe no provider. Depois desligar a flag em homolog de novo.
