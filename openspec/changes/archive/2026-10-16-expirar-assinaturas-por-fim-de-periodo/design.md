# Design

## Context

- A SPA 1142 guarda `UF_CRM_91_STATUS` (enum: `13617` Ativo, `13619` Em teste, `13621` Vencido, `13623` Cancelado, `14353` Teste expirado) e `UF_CRM_91_CURRENT_PERIOD_END` (dia de calendário).
- Hoje a expiração só existe na leitura. `resolveLineEntitlement` (`modules/thinkzap/domain/connector-trial.ts`) trata `trialing` fora da janela como `trial-expired` e ignora a data quando o status é `active`. `DisconnectExpiredLine` age quando uma leitura percebe o trial vencido. Nenhum caminho grava o status na SPA. O comentário de `Subscription.status` diz que `trial_expired` é escrito "de fora do produto", mas essa automação não existe ou não está rodando.
- A assinatura manual é criada e renovada por automação externa, que empurra `CURRENT_PERIOD_END` quando o boleto é pago. Se o boleto não é pago, nada muda a assinatura.
- Já existe um padrão de job agendado: `shared/infra/scheduler/credential-refresh.job.ts` usa `node-cron` e um lock no Redis por rodada, e é iniciado em `app.ts`.
- `BitrixSubscriptionsRepository.list` não pagina (só 50 itens) e lança erro se o plano ou a aplicação de qualquer item faltar. Por isso não serve para varrer a SPA inteira.
- `updateSubscription({ status })` grava só `ufCrm91Status`, porque o mapper omite os campos ausentes. A versão com cache (`CachedSubscriptionRepository`) também atualiza o cache.
- Produção e homolog dividem o portal. `env.payments.spa.providerEffectsEnabled` já separa os dois.

## Goals / Non-Goals

**Goals:**
- Gravar `trial_expired` nos trials vencidos e `past_due` nas manuais vencidas (depois da carência), sem ação manual.
- Fazer isso de forma idempotente, segura com várias instâncias e só em produção.

**Non-Goals:**
- Mudar `resolveLineEntitlement`. Uma manual `active` vencida continua habilitada na leitura até o job rodar, o que leva no máximo uma hora mais a carência.
- Mexer em assinaturas Stripe, que o webhook do gateway mantém.
- Desassinar ou desconectar no provider. O `UPDATE` da 1142 já trata `past_due` sem desassinar, e o `trial_expired` é desconectado pela leitura.
- Passar `past_due` para `cancelled` depois de um tempo. Isso fica com o time.

## Decisions

1. **Job de varredura com `node-cron` e lock no Redis, a cada hora (`0 * * * *`).** Segue o mesmo padrão de `credential-refresh.job.ts`: lock `subscription-expiration:tick` com TTL menor que o intervalo. Não usamos o repeatable do BullMQ porque o problema é uma varredura simples, sem payload nem retry por job. A rodada seguinte já é o retry. Rodar a cada hora deixa o atraso perto de zero, e o custo é baixo, porque o filtro no servidor devolve quase nada.

2. **Leitor dedicado, sem hidratar e com paginação: `ExpiringSubscriptionLister` (porta em `modules/application/domain`, implementação Bitrix em `infra/bitrix/readers`).** Ele roda `crm.item.list` na 1142 com:
   - filtro `ufCrm91Status` em `[13619, 13617]` e `<=ufCrm91CurrentPeriodEnd` até a data de hoje (o servidor filtra por alto e o domínio confere de novo);
   - `select` de `id`, `ufCrm91Status`, `ufCrm91CurrentPeriodEnd` e do campo de modalidade;
   - paginação por `next`, como em `BitrixSubscriptionItemIdLister`.

   O resultado é `{ id, status, currentPeriodEnd, modality }`, com o parse da data e da modalidade reaproveitado do mapper atual (`parseSpaCalendarDate` + `endOfCalendarDay` e a modalidade tolerante). Item inválido é descartado com `warn` e não derruba a rodada. A alternativa era `getSubscriptions()`, que foi descartada porque não pagina e lança erro por plano ou aplicação faltando.

3. **Regra pura no domínio: `resolveExpiredSubscriptionStatus(sub, now, manualGraceDays)` devolve `'trial_expired' | 'past_due' | null`.**
   - `trialing` e `now > currentPeriodEnd` → `trial_expired`. É o mesmo corte de `resolveLineEntitlement` (`>`, fim do dia em UTC), para que o job e a leitura nunca discordem.
   - `active`, `modality === 'manual'` e `now > currentPeriodEnd + graceDays * 24h` → `past_due`.
   - Qualquer outro caso → `null`.

   A regra fica perto de `connector-trial.ts`, ou em `modules/application/domain`, para a leitura e o job usarem o mesmo corte.

4. **Gravação por `SubscriptionRepository.updateSubscription(id, { status })` com a versão com cache.** Grava só o status e atualiza o cache. A gravação dispara `ONCRMDYNAMICITEMUPDATE_1142`, que invalida o cache e enfileira o billing sync. O billing sync não faz nada para `past_due` ou `trial_expired`. Se o `getSubscription` depois do update lançar erro (plano quebrado), o status já foi gravado. A falha é só registrada em log, e a rodada seguinte não acha mais a assinatura.

5. **Caso de uso `ExpireSubscriptions` (`modules/application/application/expire-subscriptions.ts`).** Ele lista, aplica a regra e grava uma assinatura por vez, em sequência para não estourar o limite do Bitrix. Cada item tem seu próprio `try/catch`. No fim, registra um resumo (`checked`, `trialExpired`, `pastDue`, `failed`). `BitrixMethodPausedError` encerra a rodada, que volta no próximo tick.

6. **Configuração em `env.payments.expiration`:**
   - `enabled`: `SUBSCRIPTION_EXPIRATION_ENABLED`. Se a variável não existir, usa o valor de `providerEffectsEnabled`. Assim homolog, que já tem `THINKZAP_SPA_PROVIDER_EFFECTS_ENABLED=false`, fica desligado sem configuração nova, e produção liga sozinha.
   - `manualGraceDays`: `MANUAL_SUBSCRIPTION_GRACE_DAYS`, inteiro `>= 0`, padrão `0`. Valor inválido vira `0` com `warn` no boot.

   Com `enabled=false`, o job nem é agendado.

## Risks / Trade-offs

- **O filtro de data do Bitrix usa o fuso do portal.** → O filtro no servidor é largo (até o dia de hoje), e a regra pura decide de verdade. Nunca gravamos por causa do filtro sozinho.
- **Uma automação externa que renova o período depois do vencimento pode encontrar a assinatura já `Vencido`.** → Esse é o comportamento pedido. Ela precisa passar o status para `Ativo` junto com o novo período. A carência configurável existe para cobrir o atraso normal da compensação do boleto. Isso precisa ser comunicado a quem mantém a automação.
- **O corte em UTC difere do fuso de negócio (`America/Sao_Paulo`).** → O vencimento acontece às 21h do horário de Brasília do último dia. É o mesmo corte que a leitura já usa no trial. Mudar isso fica fora deste change.
- **Gravar o status faz o webhook chegar em produção e em homolog.** → Os dois já tratam o `UPDATE` da 1142. Em homolog, os efeitos de provider estão desligados.
- **Várias instâncias.** → Lock no Redis por rodada. Mesmo sem o lock a gravação seria idempotente: gravaria o mesmo status duas vezes.

## Migration Plan

1. Fazer o deploy com `SUBSCRIPTION_EXPIRATION_ENABLED` sem definir (ou seja, igual a `providerEffectsEnabled`) e `MANUAL_SUBSCRIPTION_GRACE_DAYS` com o valor combinado com o financeiro.
2. Na primeira rodada, todo o estoque atrasado é atualizado de uma vez (trials vencidos e manuais vencidas). Antes do deploy, vale listar na SPA as manuais `Ativo` com período no passado e confirmar com o time que todas devem mesmo virar `Vencido`.
3. Rollback: `SUBSCRIPTION_EXPIRATION_ENABLED=false` e reiniciar. Os status já gravados são revertidos à mão no CRM.

## Open Questions

- Nenhuma que bloqueie. O valor inicial da carência em produção é uma decisão de operação, não de código.
