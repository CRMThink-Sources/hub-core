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
  LegacySubscriptionRow,
  lineName,
  mapLegacyStatus,
  matchExistingItems,
  reportQuantityDivergence,
  resolveInstanceMetadata,
  resolvePlanByProvider,
} from './resolve-legacy-subscription-backfill'

/**
 * Espelha nas SPAs de cobrança as assinaturas que só existem no banco legado.
 *
 * **Por que existe:** o runtime decide se a linha funciona lendo a assinatura na SPA
 * 1142 e o item na 1146. Cliente que já pagava antes dessa arquitetura tem a
 * assinatura em `billing_subscriptions` e a linha em `core_thinkerszap_instances` —
 * nenhuma das duas é consultada por caminho de habilitação nenhum. O sintoma é
 * cliente pagante com linha morta.
 *
 * **Prazo:** a migration `20260803120000_drop_billing_subscriptions_and_plans` dropa
 * as tabelas legadas. Depois dela o vínculo instalação↔Stripe existe só na API do
 * Stripe, e este script não tem de onde ler — ele sonda `information_schema` e aborta
 * dizendo isso.
 *
 * **Escreve só na SPA.** Nada é gravado no banco e nada é gravado no Stripe, que é
 * lido apenas para obter o período de cobrança.
 *
 * **Escreve só com `--apply`.** Sem a flag é relatório: é cobrança de cliente em
 * produção, e o default seguro é não tocar em nada.
 *
 * **Idempotente em dois níveis:** assinatura já espelhada é reconhecida pelo
 * `gatewayId`, e instância já espelhada é reconhecida pela credencial no item. Um
 * re-run depois de correção manual, ou depois de uma parada no meio, completa o que
 * falta sem duplicar cobrança.
 *
 * **Aborta antes da primeira escrita** quando um pré-requisito não está cumprido:
 * tabela dropada, chave do Stripe vazia, campo inexistente na SPA, plano ambíguo.
 * Falhar no meio deixaria metade das instalações espelhadas.
 */

/** Mesmo limite dos outros backfills: lote de 50 e processamento sequencial. */
const BATCH_SIZE = 50

const DROP_MIGRATION = '20260803120000_drop_billing_subscriptions_and_plans'

type Counters = {
  subscriptionsCreated: number
  itemsCreated: number
  alreadyMirrored: number
  skippedByStatus: number
  withoutSpaId: number
  missingInGateway: number
  instancesWithoutCredential: number
  orphanInstances: number
  quantityDivergences: number
  failures: number
}

type ResolvedInstallation = {
  legacy: LegacySubscriptionRow
  appId: string
  aplicationSpaId: string
  title: string
  status: Subscription['status']
  instances: LegacyInstanceRow[]
}

const parseArgs = () => ({ apply: process.argv.slice(2).includes('--apply') })

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
 * Sonda de existência, antes de qualquer outra leitura.
 *
 * Deixar `ER_NO_SUCH_TABLE` subir seria diagnóstico errado: o erro cru parece falha
 * de conexão, e o operador tentaria de novo em vez de perceber que a janela fechou e
 * que o dado agora só existe na API do Stripe.
 */
async function probeLegacyTables(): Promise<void> {
  const rows = await prisma.$queryRaw<Array<{ TABLE_NAME: string }>>`
    SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME IN ('billing_subscriptions', 'billing_plans')
  `

  const present = new Set(rows.map(row => String(row.TABLE_NAME)))

  if (!present.has('billing_subscriptions')) {
    abort(
      `A tabela 'billing_subscriptions' não existe neste banco: a migration ` +
        `${DROP_MIGRATION} já foi aplicada.\n` +
        'O vínculo instalação↔Stripe não é mais recuperável pelo banco — a partir ' +
        'daqui ele só existe na API do Stripe, e reconstruí-lo exige casar cliente ' +
        'por e-mail, que é escopo diferente deste script.',
    )
  }

  if (!present.has('billing_plans')) {
    /**
     * Aviso, não abort: o plano da assinatura é resolvido pelo provider do conector
     * na SPA 1138, e `billing_plans` não é lida no caminho principal. Mas a ausência
     * dela com a outra presente indica drop parcial, e vale registrar.
     */
    console.warn(
      `[aviso] 'billing_plans' não existe mas 'billing_subscriptions' sim — drop ` +
        'parcial. O backfill não depende dela (o plano vem do provider), então segue.',
    )
  }
}

/** Contagem por status, para o resumo dizer quantas ficaram de fora e por quê. */
async function countByStatus(): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<Array<{ status: string; total: bigint }>>`
    SELECT status, COUNT(*) AS total FROM billing_subscriptions GROUP BY status
  `

  return new Map(rows.map(row => [String(row.status), Number(row.total)]))
}

async function readEligibleSubscriptions(): Promise<LegacySubscriptionRow[]> {
  const rows = await prisma.$queryRaw<
    Array<{
      id: string
      app_id: string
      status: string
      stripe_subscription_id: string
      connector_quantity: number
      trial_ends_at: Date | null
      created_at: Date
    }>
  >`
    SELECT id, app_id, status, stripe_subscription_id,
           connector_quantity, trial_ends_at, created_at
      FROM billing_subscriptions
     WHERE status IN ('ACTIVE', 'TRIALING')
     ORDER BY created_at ASC
  `

  return rows.map(row => ({
    id: String(row.id),
    appId: String(row.app_id),
    status: String(row.status),
    stripeSubscriptionId: String(row.stripe_subscription_id),
    connectorQuantity: Number(row.connector_quantity ?? 0),
    trialEndsAt: row.trial_ends_at ? new Date(row.trial_ends_at) : null,
    createdAt: new Date(row.created_at),
  }))
}

/**
 * As instâncias de cada instalação, pelo vínculo de `core_thinkerszap_connectors`.
 *
 * O conector é o vínculo autoritativo (`app_id` → `instance_id` único). Casar por
 * `Instance.domain_id` + app code parece equivalente e não é: um domínio pode ter
 * mais de uma instalação, e a atribuição por domínio poria a linha de uma na
 * assinatura de outra.
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

    const row: LegacyInstanceRow = {
      id: connector.instance.id,
      instanceId: connector.instance.instanceId,
      zApiToken: connector.instance.zApiToken,
      channelId: connector.instance.channelId,
      wabaId: connector.instance.wabaId,
      vinculatedChannel: connector.instance.vinculatedChannel,
    }

    byApp.set(connector.appId, [...(byApp.get(connector.appId) ?? []), row])
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

function isResourceMissing(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === 'resource_missing'
  )
}

async function main() {
  const { apply } = parseArgs()

  // ---- Guards de configuração, antes de qualquer leitura pesada ----
  if (!env.crmthinkWebhookUrl) {
    abort('CRMTHINK_WEBHOOK_URL está vazio: sem ele não há SPA onde escrever.')
  }
  if (!env.payments.stripe.secretKey) {
    abort(
      'STRIPE_SECRET_KEY está vazia. O período de cobrança vem do gateway — sem a ' +
        'chave nenhuma assinatura teria período, e o run inteiro seria perdido.',
    )
  }

  // ---- Guard da janela: as tabelas legadas ainda existem? ----
  await probeLegacyTables()

  const statusCounts = await countByStatus()
  const eligible = await readEligibleSubscriptions()
  const skippedByStatus = [...statusCounts.entries()]
    .filter(([status]) => mapLegacyStatus(status) === null)
    .reduce((total, [, count]) => total + count, 0)

  if (eligible.length === 0) {
    console.log(
      `Nada a fazer: nenhuma assinatura legada ACTIVE ou TRIALING ` +
        `(${skippedByStatus} linha(s) fora por status).`,
    )
    return
  }

  console.log(
    `${eligible.length} assinatura(s) legada(s) elegível(is); ` +
      `${skippedByStatus} fora por status.`,
  )

  // ---- Resolução das instalações e das instâncias ----
  const apps = await prisma.app.findMany({
    where: { id: { in: eligible.map(row => row.appId) } },
    select: { id: true, spaId: true, domainId: true, appCodeId: true },
  })
  const appById = new Map(apps.map(app => [app.id, app]))

  const instancesByApp = await readInstancesByApp(apps.map(app => app.id))

  const counters: Counters = {
    subscriptionsCreated: 0,
    itemsCreated: 0,
    alreadyMirrored: 0,
    skippedByStatus,
    withoutSpaId: 0,
    missingInGateway: 0,
    instancesWithoutCredential: 0,
    orphanInstances: 0,
    quantityDivergences: 0,
    failures: 0,
  }

  const bitrix = new BitrixClient({ webhook: env.crmthinkWebhookUrl })
  const titles = new BitrixAplicationTitleReader(bitrix)

  const resolved: ResolvedInstallation[] = []

  const spaIds = apps
    .map(app => app.spaId)
    .filter((id): id is string => Boolean(id))
  const titleBySpaId = await titles.getTitlesBySpaIds(spaIds)

  for (const legacy of eligible) {
    const app = appById.get(legacy.appId)

    if (!app) {
      counters.failures += 1
      console.error(
        `[falha] assinatura legada ${legacy.id}: app_id ${legacy.appId} não existe ` +
          'em core_apps',
      )
      continue
    }

    if (!app.spaId) {
      counters.withoutSpaId += 1
      console.warn(
        `[sem spa_id] app ${app.id}: instalação sem espelho na SPA 1060 — rode ` +
          '`yarn backfill:aplication-spa-id` antes',
      )
      continue
    }

    const status = mapLegacyStatus(legacy.status)
    if (!status) {
      // Defensivo: a consulta já filtra, mas o mapa é a autoridade sobre o domínio.
      counters.skippedByStatus += 1
      continue
    }

    resolved.push({
      legacy,
      appId: app.id,
      aplicationSpaId: app.spaId,
      // Sem título no espelho (item apagado no CRM, falha de rede), o app code
      // identifica a instalação melhor que um nome vazio no item da SPA.
      title: titleBySpaId.get(app.spaId) ?? app.appCodeId,
      status,
      instances: instancesByApp.get(app.id) ?? [],
    })
  }

  if (resolved.length === 0) {
    console.log(
      '\nNenhuma instalação resolvível. Resumo: ' +
        `${counters.withoutSpaId} sem spa_id, ${counters.failures} falha(s).`,
    )
    return
  }

  counters.orphanInstances = await countOrphanInstances([
    ...new Set(
      resolved
        .map(row => appById.get(row.appId)?.domainId)
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

  const stripe = new Stripe(env.payments.stripe.secretKey)

  console.log(
    `\n${apply ? 'Aplicando' : 'Dry-run'} sobre ${resolved.length} instalação(ões):\n`,
  )

  for (let start = 0; start < resolved.length; start += BATCH_SIZE) {
    for (const installation of resolved.slice(start, start + BATCH_SIZE)) {
      const label = `app ${installation.appId} (${installation.title})`

      try {
        await processInstallation(installation, label, {
          apply,
          stripe,
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
  stripe: Stripe
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
  const { legacy } = installation
  const { counters } = deps

  const divergence = reportQuantityDivergence(
    legacy.connectorQuantity,
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
    legacy.stripeSubscriptionId,
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
     * Período do gateway. Nunca estimado: data de cobrança errada na tela é dano
     * silencioso, e a instalação pulada aparece no resumo para ser resolvida à mão.
     */
    let period
    try {
      const remote = await deps.stripe.subscriptions.retrieve(
        legacy.stripeSubscriptionId,
      )
      period = readSubscriptionPeriod(remote)
    } catch (error) {
      if (!isResourceMissing(error)) throw error
      period = null
    }

    if (!period) {
      counters.missingInGateway += 1
      console.warn(
        `[ausente no gateway] ${label}: assinatura ${legacy.stripeSubscriptionId} ` +
          'não trouxe período — pulada, resolver à mão',
      )
      return
    }

    if (
      installation.status === 'trialing' &&
      legacy.trialEndsAt &&
      legacy.trialEndsAt.getTime() !== period.currentPeriodEnd.getTime()
    ) {
      console.warn(
        `[divergência de trial] ${label}: trial_ends_at ` +
          `${legacy.trialEndsAt.toISOString()} difere do fim de período do gateway ` +
          `${period.currentPeriodEnd.toISOString()} — usando o do gateway`,
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
      gatewayId: legacy.stripeSubscriptionId,
      modality: 'stripe' as const,
    }

    if (!deps.apply) {
      counters.subscriptionsCreated += 1
      console.log(
        `[dry-run] ${label} → assinatura ${input.status} plano ${planId} ` +
          `período ${period.currentPeriodStart.toISOString()}..${period.currentPeriodEnd.toISOString()} ` +
          `gateway ${legacy.stripeSubscriptionId}`,
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
 * O provider da instalação, para escolher o plano.
 *
 * A primeira instância com credencial decide. Instalação com linhas de providers
 * diferentes existe e é caso raro: o aviso registra, e a assinatura fica com o plano
 * do provider predominante na ordem de leitura — corrigir mistura de plano é decisão
 * comercial, não inferência de script.
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
      )} sob a mesma assinatura — plano do primeiro, conferir à mão`,
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

  // Item existente é reconhecido e nunca atualizado: o que está na SPA é
  // configuração do cliente e vale mais que o dado congelado no banco.
  for (const { instance, metadata } of match.missing) {
    if (!deps.apply) {
      counters.itemsCreated += 1
      console.log(`  [dry-run] item ${describeMetadata(metadata)}`)
      continue
    }

    try {
      const item = await deps.items.createSubscriptionItem({
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
      console.log(`  [criado] item ${item.id} — ${describeMetadata(metadata)}`)
    } catch (error) {
      counters.failures += 1
      console.error(
        `  [falha no item] ${label} → instância ${instance.id}:`,
        error instanceof Error ? error.message : error,
      )
    }
  }
}

/** Credencial resumida para o log, sem despejar token. */
function describeMetadata(metadata: SubscriptionItemMetadata): string {
  switch (metadata.provider) {
    case 'ZAPI':
      return `ZAPI instância ${metadata.zApiInstanceId}`
    case 'HUBMESSAGE':
      return `HUBMESSAGE canal ${metadata.hubmessageChannelId}${
        metadata.wabaId ? ` waba ${metadata.wabaId}` : ' (sem WABA)'
      }`
    case 'NONE':
      return 'sem conector'
  }
}

function printSummary(counters: Counters, total: number, apply: boolean): void {
  console.log(
    `\nResumo${apply ? '' : ' (dry-run — nada gravado, use --apply)'}:\n` +
      `  ${counters.subscriptionsCreated} assinatura(s) criada(s)\n` +
      `  ${counters.itemsCreated} item(ns) criado(s)\n` +
      `  ${counters.alreadyMirrored} já espelhada(s)\n` +
      `  ${counters.skippedByStatus} pulada(s) por status\n` +
      `  ${counters.withoutSpaId} sem spa_id na instalação\n` +
      `  ${counters.missingInGateway} ausente(s) no gateway\n` +
      `  ${counters.instancesWithoutCredential} instância(s) sem credencial completa\n` +
      `  ${counters.orphanInstances} instância(s) órfã(s) sem conector\n` +
      `  ${counters.quantityDivergences} divergência(s) de quantidade contratada\n` +
      `  ${counters.failures} falha(s)\n` +
      `  de ${total} instalação(ões) resolvida(s).`,
  )
}

/**
 * Desfecho esperado — pulo por status, sem `spa_id`, ausente no gateway, credencial
 * incompleta — **não** vira código de saída diferente de zero: o resumo é o
 * relatório, e o script existe para separar o que migrou do que precisa de decisão
 * humana. Pré-requisito não cumprido sai por `abort`, que já encerra com 1.
 */
main()
  .catch(error => {
    console.error('Falha no backfill de cobrança legada:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await redisConnection.quit()
  })
