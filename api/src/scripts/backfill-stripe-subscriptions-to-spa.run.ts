import Stripe from 'stripe'

import { env } from '@/config/env'
import { prisma } from '@/config/prisma.js'
import { PlanProvider } from '@/modules/application/domain/entities/plan'
import { Subscription } from '@/modules/application/domain/entities/subscription'
import { SubscriptionItemMetadata } from '@/modules/application/domain/entities/subscription-item'
import { BitrixAplicationTitleReader } from '@/modules/application/infra/bitrix/readers/bitrix-aplication-title.reader'
import { BitrixPlanRepository } from '@/modules/application/infra/bitrix/repositories/bitrix-plans.repository'
import { BitrixProductRepository } from '@/modules/application/infra/bitrix/repositories/bitrix-products.repository'
import { BitrixSubscriptionRepository } from '@/modules/application/infra/bitrix/repositories/bitrix-subscriptions.repository'
import { ensureSubscriptionItemProviderField } from '@/modules/application/infra/bitrix/ensure-subscription-item-provider-field'
import { ensureSubscriptionItemSettingsField } from '@/modules/application/infra/bitrix/ensure-subscription-item-settings-field'
import { CachedPlanRepository } from '@/modules/application/infra/cache/cached-plan.repository'
import { CachedProductRepository } from '@/modules/application/infra/cache/cached-product.repository'
import { CachedSubscriptionRepository } from '@/modules/application/infra/cache/cached-subscription.repository'
import { PrismaAplicationRepository } from '@/modules/application/infra/prisma/repositories/prisma-aplications.repository'
import { makeSubscriptionItemRepository } from '@/modules/application/main/make-subscription-item-repository'
import { readSubscriptionPeriod } from '@/modules/thinkzap/infra/gateway/read-subscription-period'
import { redisConnection } from '@/queue/redis-connection'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import {
  LegacyInstanceRow,
  lineName,
  matchExistingItems,
  reportQuantityDivergence,
  resolveInstanceMetadata,
  resolvePlanByProvider,
} from './resolve-legacy-subscription-backfill'
import {
  StripeSubscriptionRow,
  toStripeSubscriptionRow,
  triageSubscriptions,
} from './resolve-stripe-subscription-backfill'

/**
 * Espelha nas SPAs de cobrança as assinaturas que existem **só no Stripe**.
 *
 * **Por que existe:** o runtime decide se a linha funciona lendo a assinatura na SPA
 * 1142 e o item na 1146. O irmão deste script,
 * `backfill-legacy-subscriptions-to-spa`, fazia isso lendo `billing_subscriptions` —
 * mas aquela tabela foi dropada pela migration
 * `20260803120000_drop_billing_subscriptions_and_plans` antes de o espelhamento
 * acontecer. O vínculo instalação↔assinatura sobreviveu em um único lugar: o
 * `metadata.clientId` de cada assinatura do gateway, que é o id do item da
 * instalação na SPA 1060 — o mesmo valor de `core_apps.spa_id`.
 *
 * **Pré-requisito:** `core_apps.spa_id` preenchido. A coluna nasce `NULL` na
 * migration `20260729000000_add_spa_id_to_core_apps`, e é ela que casa o `clientId`
 * do gateway com a instalação. Rode `yarn backfill:aplication-spa-id` primeiro — sem
 * isso este script não resolve nenhuma instalação e diz exatamente isso.
 *
 * **Escreve só na SPA.** Nada é gravado no banco e nada é gravado no Stripe, que é
 * lido de ponta a ponta (listagem por preço) e nada mais.
 *
 * **Escreve só com `--apply`.** Sem a flag é relatório: é cobrança de cliente em
 * produção, e o default seguro é não tocar em nada.
 *
 * **Idempotente em dois níveis**, igual ao legado: assinatura já espelhada é
 * reconhecida pelo `gatewayId`, e instância já espelhada é reconhecida pela
 * credencial no item. Re-run depois de correção manual completa o que falta sem
 * duplicar cobrança.
 *
 * **Aborta antes da primeira escrita** quando um pré-requisito não está cumprido:
 * chave do Stripe vazia, webhook do CRM vazio, campo inexistente na SPA, plano
 * ambíguo. Falhar no meio deixaria metade das instalações espelhadas.
 *
 * Uso:
 *   yarn backfill:stripe-subscriptions-to-spa --env-file .env.production
 *   yarn backfill:stripe-subscriptions-to-spa --env-file .env.production --apply
 *   yarn backfill:stripe-subscriptions-to-spa --env-file .env.production --price price_xxx
 */

/** Mesmo limite dos outros backfills: lote de 50 e processamento sequencial. */
const BATCH_SIZE = 50

/**
 * Preço da linha no gateway. Default do produto atual, sobrescrevível por `--price`
 * para o caso de haver preço antigo com assinaturas vivas.
 */
const DEFAULT_PRICE_ID = 'price_1TPVJkBLb9aLDvFDrQ5mIInf'

type Counters = {
  subscriptionsCreated: number
  itemsCreated: number
  itemsAlreadyPresent: number
  alreadyMirrored: number
  skippedByStatus: number
  withoutClientId: number
  clientIdWithoutApp: number
  missingPeriod: number
  instancesWithoutCredential: number
  orphanInstances: number
  quantityDivergences: number
  failures: number
}

type ResolvedInstallation = {
  gateway: StripeSubscriptionRow
  appId: string
  aplicationSpaId: string
  title: string
  status: Subscription['status']
  instances: LegacyInstanceRow[]
}

function parseArgs(): { apply: boolean; priceId: string } {
  const argv = process.argv.slice(2)
  const priceIndex = argv.indexOf('--price')
  const priceId =
    priceIndex === -1 ? DEFAULT_PRICE_ID : (argv[priceIndex + 1] ?? '')

  if (!priceId || priceId.startsWith('--')) {
    abort('--price exige um id de preço: --price price_xxx')
  }

  return { apply: argv.includes('--apply'), priceId }
}

/**
 * Aborta com mensagem própria. Todo `exit(1)` deste script passa por aqui, para que
 * a diferença entre "pré-requisito não cumprido" e "instalação pulada" seja visível
 * no código, não só no output.
 */
function abort(message: string): never {
  console.error(`\n[abortado] ${message}`)
  process.exit(1)
}

/**
 * Todas as assinaturas do preço, incluindo as que não serão espelhadas.
 *
 * `status: 'all'` de propósito: a triagem por status é decisão do domínio
 * (`mapStripeStatus`), e trazer só as ativas esconderia do relatório quantas
 * ficaram de fora e por quê — que é a informação que diz se o backfill cobriu a
 * carteira inteira.
 */
async function readSubscriptionsByPrice(
  stripe: Stripe,
  priceId: string,
): Promise<{
  rows: StripeSubscriptionRow[]
  periods: Map<string, Stripe.Subscription>
}> {
  const rows: StripeSubscriptionRow[] = []
  const periods = new Map<string, Stripe.Subscription>()

  for await (const subscription of stripe.subscriptions.list({
    price: priceId,
    status: 'all',
    limit: 100,
  })) {
    rows.push(toStripeSubscriptionRow(subscription))
    /**
     * O objeto cru é guardado porque o período pode estar nele ou no item de linha,
     * e `readSubscriptionPeriod` resolve os dois. Guardar aqui evita um `retrieve`
     * por assinatura na fase de escrita — a listagem já trouxe tudo.
     */
    periods.set(subscription.id, subscription)
  }

  return { rows, periods }
}

/**
 * As instâncias de cada instalação, pelo vínculo de `core_thinkerszap_connectors`.
 *
 * Mesma consulta do backfill legado, pelo mesmo motivo: o conector é o vínculo
 * autoritativo (`app_id` → `instance_id`). Casar por `Instance.domain_id` + app code
 * parece equivalente e não é — um domínio pode ter mais de uma instalação, e a
 * atribuição por domínio poria a linha de uma na assinatura de outra.
 */
async function readInstancesByApp(
  appIds: string[],
): Promise<Map<string, LegacyInstanceRow[]>> {
  const byApp = new Map<string, LegacyInstanceRow[]>()
  if (appIds.length === 0) return byApp

  const connectors = await prisma.connector.findMany({
    where: { appId: { in: appIds }, instanceId: { not: null } },
    select: {
      appId: true,
      instance: {
        select: {
          id: true,
          instanceId: true,
          zApiToken: true,
          channelId: true,
          wabaId: true,
          vinculatedChannel: true,
        },
      },
    },
  })

  for (const connector of connectors) {
    if (!connector.instance) continue

    byApp.set(connector.appId, [
      ...(byApp.get(connector.appId) ?? []),
      {
        id: connector.instance.id,
        instanceId: connector.instance.instanceId,
        zApiToken: connector.instance.zApiToken,
        channelId: connector.instance.channelId,
        wabaId: connector.instance.wabaId,
        vinculatedChannel: connector.instance.vinculatedChannel,
      },
    ])
  }

  return byApp
}

/**
 * Instância que existe no domínio de uma instalação a migrar mas não tem linha em
 * `connectors`. Reportada, nunca migrada: não há critério honesto para dizer de qual
 * instalação ela é quando o domínio tem mais de uma.
 */
async function countOrphanInstances(domainIds: string[]): Promise<number> {
  if (domainIds.length === 0) return 0

  return prisma.instance.count({
    where: { domainId: { in: domainIds }, connector: { is: null } },
  })
}

async function main() {
  const { apply, priceId } = parseArgs()

  // ---- Guards de configuração, antes de qualquer leitura pesada ----
  if (!env.crmthinkWebhookUrl) {
    abort('CRMTHINK_WEBHOOK_URL está vazio: sem ele não há SPA onde escrever.')
  }
  if (!env.payments.stripe.secretKey) {
    abort(
      'STRIPE_SECRET_KEY está vazia. O gateway é a única fonte do vínculo ' +
        'instalação↔assinatura desde o drop de `billing_subscriptions` — sem a ' +
        'chave não há nada a ler.',
    )
  }

  const stripe = new Stripe(env.payments.stripe.secretKey)

  console.log(`Lendo assinaturas do preço ${priceId} no gateway...`)
  const { rows, periods } = await readSubscriptionsByPrice(stripe, priceId)

  if (rows.length === 0) {
    abort(
      `Nenhuma assinatura encontrada para o preço ${priceId}. Confira o id (o ` +
        'default do script é o preço atual da linha) e a chave do Stripe — chave ' +
        'de teste não vê assinatura de produção.',
    )
  }

  const triage = triageSubscriptions(rows)

  const counters: Counters = {
    subscriptionsCreated: 0,
    itemsCreated: 0,
    itemsAlreadyPresent: 0,
    alreadyMirrored: 0,
    skippedByStatus: 0,
    withoutClientId: 0,
    clientIdWithoutApp: 0,
    missingPeriod: 0,
    instancesWithoutCredential: 0,
    orphanInstances: 0,
    quantityDivergences: 0,
    failures: 0,
  }

  for (const problem of triage.problems) {
    if (problem.kind === 'status') {
      counters.skippedByStatus += 1
      continue
    }

    counters.withoutClientId += 1
    console.warn(
      `[sem clientId] assinatura ${problem.row.id} (${problem.row.status}): ` +
        'metadata.clientId ausente — sem ele não há instalação a que vincular, ' +
        'resolver à mão no dashboard do Stripe',
    )
  }

  console.log(
    `${rows.length} assinatura(s) no preço; ${triage.eligible.length} elegível(is), ` +
      `${counters.skippedByStatus} fora por status, ${counters.withoutClientId} sem clientId.`,
  )

  if (triage.eligible.length === 0) {
    console.log('\nNada a espelhar.')
    return
  }

  // ---- Resolução das instalações pelo spa_id ----
  const clientIds = [
    ...new Set(triage.eligible.map(entry => entry.row.clientId as string)),
  ]

  const apps = await prisma.app.findMany({
    where: { spaId: { in: clientIds } },
    select: { id: true, spaId: true, domainId: true, appCodeId: true },
  })
  const appBySpaId = new Map(
    apps
      .filter(app => app.spaId)
      .map(app => [app.spaId as string, app] as const),
  )

  if (appBySpaId.size === 0) {
    abort(
      `Nenhuma das ${clientIds.length} instalação(ões) referenciada(s) pelo gateway ` +
        'foi encontrada por `core_apps.spa_id`.\n' +
        'A coluna nasce NULL na migration 20260729000000_add_spa_id_to_core_apps: ' +
        'rode `yarn backfill:aplication-spa-id` primeiro. Sem ela o clientId do ' +
        'gateway não casa com instalação nenhuma.',
    )
  }

  const instancesByApp = await readInstancesByApp(apps.map(app => app.id))

  const bitrix = new BitrixClient({ webhook: env.crmthinkWebhookUrl })
  const titles = new BitrixAplicationTitleReader(bitrix)
  const titleBySpaId = await titles.getTitlesBySpaIds([...appBySpaId.keys()])

  const resolved: ResolvedInstallation[] = []

  for (const { row, status } of triage.eligible) {
    const app = appBySpaId.get(row.clientId as string)

    if (!app) {
      counters.clientIdWithoutApp += 1
      console.warn(
        `[clientId órfão] assinatura ${row.id}: nenhuma instalação com ` +
          `spa_id ${row.clientId} — item da SPA 1060 apagado, ou spa_id ainda ` +
          'não preenchido para esta instalação',
      )
      continue
    }

    resolved.push({
      gateway: row,
      appId: app.id,
      aplicationSpaId: app.spaId as string,
      // Sem título no espelho (item apagado no CRM, falha de rede), o app code
      // identifica a instalação melhor que um nome vazio no item da SPA.
      title: titleBySpaId.get(app.spaId as string) ?? app.appCodeId,
      status,
      instances: instancesByApp.get(app.id) ?? [],
    })
  }

  if (resolved.length === 0) {
    console.log(
      `\nNenhuma instalação resolvível. Resumo: ${counters.clientIdWithoutApp} ` +
        `clientId sem instalação, ${counters.failures} falha(s).`,
    )
    return
  }

  counters.orphanInstances = await countOrphanInstances([
    ...new Set(
      resolved
        .map(row => apps.find(app => app.id === row.appId)?.domainId)
        .filter((id): id is string => Boolean(id)),
    ),
  ])

  // ---- Guard dos campos da SPA, antes de resolver plano ----
  try {
    await ensureSubscriptionItemProviderField(bitrix)
    await ensureSubscriptionItemSettingsField(bitrix)
  } catch (error) {
    abort(
      'Campo obrigatório ausente na SPA 1146: ' +
        (error instanceof Error ? error.message : String(error)) +
        '\n`crm.item.add` aceita campo desconhecido e responde sucesso descartando o ' +
        'valor — sem o campo, o backfill gravaria credencial no vazio e relataria êxito.',
    )
  }

  // ---- Guard do catálogo de planos ----
  const products = new CachedProductRepository(
    new BitrixProductRepository(bitrix),
    redisConnection,
  )
  const plans = new CachedPlanRepository(
    new BitrixPlanRepository(bitrix, products),
    redisConnection,
  )

  const providersInUse = new Set<PlanProvider>()
  for (const installation of resolved) {
    for (const instance of installation.instances) {
      const metadata = resolveInstanceMetadata(instance)
      if (metadata && metadata.provider !== 'NONE') {
        providersInUse.add(metadata.provider)
      }
    }
  }

  const catalog = await plans.getPlans()
  const planResolution = resolvePlanByProvider(catalog, providersInUse)

  if (!planResolution.ok) {
    const detail = planResolution.problems
      .map(problem =>
        problem.kind === 'missing'
          ? `provider ${problem.provider}: nenhum plano ativo com esse provider na SPA 1138`
          : `provider ${problem.provider}: planos ativos ambíguos (${problem.candidateIds.join(', ')})`,
      )
      .join('\n  ')

    abort(
      `Catálogo de planos não resolve o provider em uso:\n  ${detail}\n` +
        'Corrija na SPA 1138 e rode de novo — escolher por ordem de retorno cobraria ' +
        'o valor errado.',
    )
  }

  const { planIdByProvider } = planResolution

  /**
   * Impresso antes do loop de propósito: é o que permite comparar o output do
   * dry-run com o do `--apply` e detectar catálogo trocado entre os dois runs.
   */
  console.log(
    '\nPlano por provider: ' +
      ([...providersInUse]
        .map(provider => `${provider} → ${planIdByProvider[provider]}`)
        .join(', ') || '(nenhum provider em uso)'),
  )

  // ---- Repositórios de escrita, decorados com o mesmo cache que o contexto lê ----
  const aplications = new PrismaAplicationRepository(prisma, titles)
  const subscriptions = new CachedSubscriptionRepository(
    new BitrixSubscriptionRepository(bitrix, plans, aplications),
    redisConnection,
  )
  const items = makeSubscriptionItemRepository()

  console.log(
    `\n${apply ? 'Aplicando' : 'Dry-run'} sobre ${resolved.length} instalação(ões):\n`,
  )

  for (let start = 0; start < resolved.length; start += BATCH_SIZE) {
    for (const installation of resolved.slice(start, start + BATCH_SIZE)) {
      const label = `app ${installation.appId} (${installation.title})`

      try {
        await processInstallation(installation, label, {
          apply,
          periods,
          subscriptions,
          items,
          planIdByProvider,
          counters,
        })
      } catch (error) {
        counters.failures += 1
        console.error(
          `[falha] ${label}:`,
          error instanceof Error ? error.message : error,
        )
      }
    }
  }

  printSummary(counters, resolved.length, apply)
}

type ProcessDeps = {
  apply: boolean
  periods: Map<string, Stripe.Subscription>
  subscriptions: CachedSubscriptionRepository
  items: ReturnType<typeof makeSubscriptionItemRepository>
  planIdByProvider: Record<PlanProvider, string | undefined>
  counters: Counters
}

async function processInstallation(
  installation: ResolvedInstallation,
  label: string,
  deps: ProcessDeps,
): Promise<void> {
  const { gateway } = installation
  const { counters } = deps

  const divergence = reportQuantityDivergence(
    gateway.quantity,
    installation.instances.length,
  )
  if (divergence) {
    counters.quantityDivergences += 1
    console.warn(`[divergência] ${label}: ${divergence}`)
  }

  /**
   * Idempotência no nível da assinatura, pela mesma chave que o webhook usa. O id
   * identifica um **conjunto**: instalação cobrada por mais de um plano tem uma
   * assinatura por plano com o mesmo `gatewayId`.
   */
  const existing = await deps.subscriptions.listSubscriptionsByGatewayId(
    gateway.id,
  )

  let subscriptionId: string

  if (existing.length > 0) {
    counters.alreadyMirrored += 1
    subscriptionId = existing[0]!.id
    console.log(
      `[já espelhada] ${label} → assinatura ${subscriptionId} — conferindo itens`,
    )
  } else {
    /**
     * Período do gateway, do objeto que a listagem já trouxe. Nunca estimado: data
     * de cobrança errada na tela é dano silencioso, e a instalação pulada aparece no
     * resumo para ser resolvida à mão.
     */
    const remote = deps.periods.get(gateway.id)
    const period = remote ? readSubscriptionPeriod(remote) : null

    if (!period) {
      counters.missingPeriod += 1
      console.warn(
        `[sem período] ${label}: assinatura ${gateway.id} não trouxe ` +
          'current_period_start/end nem na assinatura nem no item — pulada, ' +
          'resolver à mão',
      )
      return
    }

    if (
      installation.status === 'trialing' &&
      gateway.trialEnd &&
      gateway.trialEnd.getTime() !== period.currentPeriodEnd.getTime()
    ) {
      console.warn(
        `[divergência de trial] ${label}: trial_end ` +
          `${gateway.trialEnd.toISOString()} difere do fim de período ` +
          `${period.currentPeriodEnd.toISOString()} — usando o do período`,
      )
    }

    const provider = firstProvider(installation)
    const planId = provider ? deps.planIdByProvider[provider] : undefined

    if (!planId) {
      /**
       * Instalação sem instância com credencial: não há provider de onde derivar
       * plano, e assinatura sem plano derruba a leitura do contexto inteiro.
       */
      counters.failures += 1
      console.error(
        `[falha] ${label}: nenhuma instância com credencial completa, sem provider ` +
          'de onde derivar o plano da assinatura',
      )
      return
    }

    const input = {
      name: `Assinatura — ${installation.title}`,
      planId,
      aplicationSpaId: installation.aplicationSpaId,
      status: installation.status,
      currentPeriodStart: period.currentPeriodStart,
      currentPeriodEnd: period.currentPeriodEnd,
      gatewayId: gateway.id,
      modality: 'stripe' as const,
    }

    if (!deps.apply) {
      counters.subscriptionsCreated += 1
      console.log(
        `[dry-run] ${label} → assinatura ${input.status} plano ${planId} ` +
          `período ${period.currentPeriodStart.toISOString()}..${period.currentPeriodEnd.toISOString()} ` +
          `gateway ${gateway.id}`,
      )
      printPlannedItems(installation, label, counters)
      return
    }

    const created = await deps.subscriptions.createSubscription(input)
    counters.subscriptionsCreated += 1
    subscriptionId = created.id
    console.log(`[criada] ${label} → assinatura ${subscriptionId}`)
  }

  await createMissingItems(installation, subscriptionId, label, deps)
}

/**
 * O provider que dá o **rótulo** ao contrato, para escolher o plano da assinatura.
 *
 * A primeira instância com credencial decide. Instalação com linhas de providers
 * diferentes é a forma vigente, e não uma exceção a corrigir: uma assinatura por
 * contrato, com os itens de todos os conectores nela. O plano da assinatura é rótulo,
 * e quem precifica cada linha é o plano do conector dela — resolvido pelo catálogo na
 * composição do contrato, não por este campo.
 *
 * O aviso fica porque o rótulo escolhido aqui é o do primeiro conector na ordem de
 * leitura, e não o do conector com mais linhas, que é a regra da escrita
 * (`ActivateLineSubscription`). Nada de cobrança depende da diferença; o nome do
 * registro no CRM sim.
 */
function firstProvider(
  installation: ResolvedInstallation,
): PlanProvider | null {
  const providers = new Set<PlanProvider>()

  for (const instance of installation.instances) {
    const metadata = resolveInstanceMetadata(instance)
    if (metadata && metadata.provider !== 'NONE')
      providers.add(metadata.provider)
  }

  if (providers.size > 1) {
    console.warn(
      `[providers mistos] app ${installation.appId}: linhas de ${[
        ...providers,
      ].join(
        ' e ',
      )} sob a mesma assinatura — forma esperada; o plano da assinatura é rótulo, e ` +
        'fica com o do primeiro conector lido, não com o do predominante',
    )
  }

  return [...providers][0] ?? null
}

function printPlannedItems(
  installation: ResolvedInstallation,
  label: string,
  counters: Counters,
): void {
  const match = matchExistingItems(installation.instances, [])

  counters.instancesWithoutCredential += match.withoutCredential.length
  for (const instance of match.withoutCredential) {
    console.warn(
      `[sem credencial] ${label} → instância ${instance.id}: nem canal nem par ` +
        'completo da Z-API',
    )
  }

  for (const { metadata } of match.missing) {
    counters.itemsCreated += 1
    console.log(`  [dry-run] item ${describeMetadata(metadata)}`)
  }
}

async function createMissingItems(
  installation: ResolvedInstallation,
  subscriptionId: string,
  label: string,
  deps: ProcessDeps,
): Promise<void> {
  const { counters } = deps

  const existingItems =
    await deps.items.getSubscriptionItemsBySubscription(subscriptionId)

  const match = matchExistingItems(installation.instances, existingItems)

  counters.instancesWithoutCredential += match.withoutCredential.length
  for (const instance of match.withoutCredential) {
    console.warn(
      `[sem credencial] ${label} → instância ${instance.id}: nem canal nem par ` +
        'completo da Z-API',
    )
  }

  /**
   * Item já presente é contado e logado, não só reconhecido em silêncio: sem esta
   * linha o resumo diz "1 item criado" tanto quando havia 1 linha quanto quando
   * havia 13 e 12 já estavam espelhadas — e as duas situações pedem ações opostas.
   */
  counters.itemsAlreadyPresent += match.alreadyPresent.length
  for (const instance of match.alreadyPresent) {
    console.log(
      `  [item já existe] instância ${instance.instanceId} — reconhecida, não alterada`,
    )
  }

  // Item existente é reconhecido e nunca atualizado: o que está na SPA é
  // configuração do cliente e vale mais que o dado congelado no banco.
  for (const { instance, metadata } of match.missing) {
    if (!deps.apply) {
      counters.itemsCreated += 1
      console.log(`  [dry-run] item ${describeMetadata(metadata)}`)
      continue
    }

    /**
     * `try` **por item**, não pela instalação: uma recusa do Bitrix no item 2 de 13
     * subiria para o loop principal e abortaria os itens 3..13, deixando a
     * instalação com uma linha cobrada e doze invisíveis — com o resumo dizendo
     * "1 item criado, 1 falha", que parece sucesso parcial pequeno. Cada item é uma
     * linha cobrada independente e falha sozinho.
     */
    try {
      await deps.items.createSubscriptionItem({
        name: lineName(metadata),
        subscription: subscriptionId,
        /**
         * `active` independente de `InstanceStatus`: `DISCONNECTED` é celular
         * desligado, não contrato encerrado.
         */
        status: 'active',
        metadata,
        ...(instance.vinculatedChannel
          ? { vinculatedChannel: instance.vinculatedChannel }
          : {}),
      })

      counters.itemsCreated += 1
      console.log(`  [item criado] ${describeMetadata(metadata)}`)
    } catch (error) {
      counters.failures += 1
      console.error(
        `  [falha no item] ${label} → instância ${instance.id}:`,
        error instanceof Error ? error.message : error,
      )
    }
  }
}

function describeMetadata(metadata: SubscriptionItemMetadata): string {
  switch (metadata.provider) {
    case 'HUBMESSAGE':
      return `HUBMESSAGE canal ${metadata.hubmessageChannelId}`
    case 'ZAPI':
      return `ZAPI instância ${metadata.zApiInstanceId}`
    case 'NONE':
      return 'sem provider'
  }
}

function printSummary(counters: Counters, total: number, apply: boolean): void {
  console.log(
    `\n${apply ? 'Aplicado' : 'Dry-run'} — ${total} instalação(ões) processada(s):\n` +
      `  assinaturas ${apply ? 'criadas' : 'a criar'}: ${counters.subscriptionsCreated}\n` +
      `  itens ${apply ? 'criados' : 'a criar'}: ${counters.itemsCreated}\n` +
      `  itens que já existiam: ${counters.itemsAlreadyPresent}\n` +
      `  assinaturas já espelhadas: ${counters.alreadyMirrored}\n` +
      `  fora por status: ${counters.skippedByStatus}\n` +
      `  sem clientId no gateway: ${counters.withoutClientId}\n` +
      `  clientId sem instalação: ${counters.clientIdWithoutApp}\n` +
      `  sem período no gateway: ${counters.missingPeriod}\n` +
      `  instâncias sem credencial: ${counters.instancesWithoutCredential}\n` +
      `  instâncias órfãs (sem conector): ${counters.orphanInstances}\n` +
      `  divergências de quantidade: ${counters.quantityDivergences}\n` +
      `  falhas: ${counters.failures}`,
  )

  if (!apply) {
    console.log('\nNada foi escrito. Repita com --apply para aplicar.')
  }
}

main()
  .catch(error => {
    console.error('\nFalha no backfill:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await redisConnection.quit()
  })
