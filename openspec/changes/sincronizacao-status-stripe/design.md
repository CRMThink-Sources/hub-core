# Design

## Context

A motivação está em `proposal.md`. O estado atual que molda a abordagem:

- **Webhook.** `HandleGatewayWebhookEvent` (`modules/thinkzap/application/handle-gateway-webhook-event.ts`) recebe `GatewayEvent` normalizado pelo `StripePaymentGateway`:
  - `applyStatus` lista as assinaturas da SPA pelo id do gateway, pula as que já concordam (status e fim do período), escreve as demais e só loga a divergência de quantidade;
  - `applyCancellation` grava `cancelled` e, só se gravou, desassina as linhas com `ProviderResourceBilling.unsubscribe`.

  Os dois retornam `void`, então quem chama não sabe o que foi feito.
- **Gateway.**
  - `StripePaymentGateway.normalize` aplica `STATUS_BY_STRIPE_STATUS`, o mapa de decisão;
  - `readSubscription` devolve o mapa **diagnóstico** (`STATUS_BY_STRIPE_STATUS_DIAGNOSTIC`, com `unknown`) e lança `GatewaySubscriptionUnreadableError` para qualquer falha, sem distinguir "não existe" de "rede";
  - o reader com cache (`CachedGatewaySubscriptionReader`) serve à tela de linhas e não pode ser usado aqui, porque a sincronização precisa do estado atual;
  - o único lugar que reconhece `resource_missing` hoje é um script de backfill.
- **SPA 1142.** Há 26 assinaturas Stripe: 14 com `ufCrm91Environment` vazio e 12 com `homolog`. O campo não é lido nem gravado pelo código. `env.payments.stripe.environment` (`production` | `homolog`) vem do prefixo da chave.
- **Jobs.** A verificação de assinaturas (`startSubscriptionExpirationJob`) dá o padrão a seguir:
  - `node-cron`, com lock Redis `SET NX` e TTL de 55 min;
  - `RunSubscriptionExpiration` com `begin`/`complete`;
  - `StartManualSubscriptionExpiration` para o "Rodar agora";
  - tabelas de rodadas e changes;
  - controllers do portal;
  - registro de jobs no front e página de detalhe.

## Goals / Non-Goals

**Goals:**
- Uma única implementação de "aplicar o estado do Stripe na SPA", usada pelo webhook e pelo job. O job não pode divergir do webhook.
- O job registra o que fez em cada assinatura, para o histórico.
- Não tocar em assinaturas de outra conta Stripe.

**Non-Goals:**
- Corrigir a divergência de quantidade de linhas (o webhook só loga; o job também só loga).
- Preencher `ufCrm91Environment` nas assinaturas antigas. O campo vazio conta como produção; corrigir é manual.
- Criar assinatura na SPA a partir do Stripe (assinatura no Stripe sem par na SPA). O job parte da SPA.
- Uma tabela genérica de rodadas para todos os jobs. Ver D4.

## Decisions

### D1. Extrair `ApplyGatewaySubscriptionState` do webhook

`applyStatus` e `applyCancellation` saem de `HandleGatewayWebhookEvent` para um caso de uso próprio, `ApplyGatewaySubscriptionState`, com dois métodos:
- `applyUpdate(gatewayId, { status, currentPeriodStart, currentPeriodEnd }, totalLineQuantity)`;
- `applyCancellation(gatewayId)`.

Os dois passam a **devolver o que fizeram** por assinatura da SPA: `unchanged` | `updated` (com antes e depois) | `cancelled` (com as linhas desassinadas, cada uma com resultado) | `failed` (com erro) | `unknown-subscription`.

O webhook chama os mesmos métodos e ignora o retorno, então o comportamento dele não muda; os testes atuais do webhook continuam valendo como estão.

`applyCancellation` hoje desassina com `ProviderResourceBilling.unsubscribe(item)`, que engole a falha (sem `propagate`) e já pula sem credencial. Para o job saber quais linhas desassinou, o método passa a usar o retorno de `runOnItem`: `unsubscribe` devolve `{ ok, provider }`. A marca de desassinado continua sendo gravada pelo mesmo código.

*Alternativa:* o job sintetizar um `GatewayEvent` e chamar `HandleGatewayWebhookEvent.execute`. Rejeitada: o retorno continuaria `void` e o histórico não teria o que registrar.

### D2. Leitura de estado no gateway, sem cache e com "não encontrada"

Novo método na porta do gateway: `readSubscriptionState(gatewayId)`. Ele devolve:

```
{ kind: 'found', status: Subscription['status'] | null, rawStatus, currentPeriodStart, currentPeriodEnd, totalLineQuantity }
{ kind: 'not-found' }
```

- `status` sai de `STATUS_BY_STRIPE_STATUS`, o mesmo mapa do webhook; `null` quando o status do Stripe está fora do mapa.
- `not-found` quando o Stripe responde `resource_missing` (404). Qualquer outro erro lança.
- `totalLineQuantity` é a soma das quantidades dos itens, como no `normalize`.

O período usa `readSubscriptionPeriod`, o mesmo do webhook. O cache não entra.

### D3. Seleção das assinaturas

Lister novo na SPA 1142: `listStripeSubscriptions()`, com `crm.item.list` por `ufCrm91Modality = stripe` e `select` de id, status, período, id do gateway e ambiente, paginado pelo `next`.

O job agrupa por id do gateway e filtra pelo ambiente, que deve ser igual a `env.payments.stripe.environment`, com vazio contando como `production`. As assinaturas de outro ambiente entram só no contador `skipped` da rodada (não geram registro).

Para cada id do gateway, o job lê o Stripe e chama `applyUpdate` ou `applyCancellation`. Os dois métodos relistam as assinaturas daquele id do gateway no repositório da SPA (como o webhook já faz). Por isso o lister do job só serve para descobrir **quais** ids ler.

### D4. Histórico em tabelas próprias

`core_stripe_sync_runs` (contadores próprios) e `core_stripe_sync_changes`:

| Coluna | Uso |
|---|---|
| `kind` | `updated`, `cancelled`, `line-unsubscribed`, `not-found`, `unknown-status`, `failed` |
| `subscription_id`, `gateway_id`, `item_id`, `provider` | identificação |
| `from_status`, `to_status` | antes e depois |
| `from_period_end`, `to_period_end` | antes e depois |
| `error` | mensagem |

O repositório e os controllers seguem o mesmo formato dos da verificação: `start`/`finish`/`fail`/`list`/`findById`/`deleteStartedBefore`.

*Alternativa:* uma coluna `job` nas tabelas da verificação. Rejeitada porque os contadores e os registros têm formas diferentes, e misturar exigiria colunas nulas para um job ou outro em quase tudo.

### D5. Job, lock e flag

- **Job:** `startStripeSyncJob` com `node-cron` `30 * * * *`. O lock Redis é separado (`stripe-sync:lock`, TTL 55 min) para não bloquear a verificação de assinaturas.
- **Rodada:** `RunStripeSync` (`begin`/`complete`/`run`) e `StartManualStripeSync`, iguais aos da verificação.
- **Flag:** `env.payments.stripeSync.enabled` vem de `STRIPE_SYNC_ENABLED`:
  - `'true'` e `'false'` valem explicitamente;
  - ausente vale `providerEffectsEnabled && stripe.environment === 'production'`.

  Assim, homologação (provider desligado, chave de teste) fica desligada sem configurar nada.
- **Retenção:** o histórico com mais de 90 dias é apagado no `finally` da rodada agendada, como na verificação.

### D6. Uma assinatura por vez, falha isolada

Os ids do gateway são processados em sequência. Cada um tem seu `try/catch`: falha de leitura no Stripe ou de escrita na SPA vira registro `failed` e o próximo segue. A pausa do Bitrix (`BitrixMethodPausedError`) encerra a rodada com `paused = true`, como na verificação.

### D7. Front

- **Registro de jobs:** nova entrada `sincronizacao-stripe`, com intervalo de 1h e `fetchRecentRuns` sobre `/portal/stripe-sync/runs`. O tipo `AdminJobId` ganha o identificador.
- **Página `AdminStripeSyncJobPage`:** mesma estrutura da página da verificação (cabeçalho, saúde, faixa de rodadas, filtros, tabela, painel, "Rodar agora"). As colunas próprias são:
  - Assinaturas (atualizadas e canceladas);
  - Linhas (desassinadas);
  - Não encontradas;
  - Falhas.
- **Componentes compartilhados:** a parte comum fica num componente. O que é igual entre as duas páginas (polling da rodada manual, paginação e diálogo) é extraído para `useJobRunsList` e `JobRunNowButton`, se a extração não mudar o comportamento da página da verificação.
- A home e o catálogo pegam o job novo pelo registro, sem mudança.

### D8. Fim do período comparado por dia de calendário

Achado na implementação: o webhook comparava o `currentPeriodEnd` da SPA com o do Stripe por instante. A SPA guarda só o dia (o mapper lê `23:59:59.999Z`), e o Stripe manda a hora real da renovação, então a comparação nunca batia. Toda reentrega reescrevia a assinatura, e no job isso viraria uma "atualização" falsa por assinatura a cada hora.

`ApplyGatewaySubscriptionState` passa a comparar o dia UTC dos dois, que é o dia que a escrita grava (`toSpaCalendarDateValue`). Isso também muda o webhook, que deixa de reescrever quando nada mudou. O efeito final na SPA é o mesmo, com menos escritas.

### D9. Página própria, sem extração

A página `AdminStripeSyncJobPage` foi gerada a partir da página da verificação, sem extrair o hook comum previsto em D7: a extração mexeria na página da verificação, que já está em uso. Os helpers da tabela (`ExpirationRunStatusBadge`, `triggeredByLabel`, `CountList`) passaram a aceitar só os campos que usam e são compartilhados.

## Risks / Trade-offs

- **[Ambiente vazio que é de teste]** Uma assinatura de teste com o campo vazio é lida em produção e volta `not-found` toda hora. → Mitigação: ela só gera o registro "não encontrada" e não altera nada. A página mostra o id para alguém preencher o ambiente.
- **[Corrida com o webhook]** O webhook e o job podem escrever a mesma assinatura no mesmo minuto. → Mitigação: os dois aplicam o mesmo estado lido do Stripe, e a escrita é idempotente (pula o que já concorda). A ordem dos eventos não importa porque o job lê o estado atual, não um evento.
- **[Cancelamento indevido]** Se o Stripe disser `canceled` por engano, o job cancela e desassina. → É o mesmo risco que o webhook já tem hoje com o `subscription.deleted`, e a regra é a pedida.
- **[Refatorar o webhook]** Extrair `ApplyGatewaySubscriptionState` mexe num caminho de cobrança em produção. → Mitigação: a task 1.1 move o código sem mudar o comportamento e roda os testes do webhook intactos antes de qualquer outra mudança.

## Migration Plan

1. Deploy da API com a migration, que só cria as duas tabelas. Em produção o job fica ligado por padrão (chave live e provider ligados).
2. Deploy do front.
3. Rollback: reverter o deploy, ou `STRIPE_SYNC_ENABLED=false` para desligar só o job. As tabelas ficam sem uso.
