import 'dotenv/config'

import { env } from '@/config/env'
import { SUBSCRIPTION_ITEM_PROVIDER_FIELD } from '@/modules/application/infra/bitrix/ensure-subscription-item-provider-field'
import {
  SUBSCRIPTION_ITEM_CONNECTED_FIELD,
  ensureSubscriptionItemConnectedField,
} from '@/modules/application/infra/bitrix/ensure-subscription-item-connected-field'
import { SUBSCRIPTION_ITEM_DELETED_AT_FIELD } from '@/modules/application/infra/bitrix/ensure-subscription-item-deletion-fields'
import { parseConnectedField } from '@/modules/application/infra/bitrix/mappers/subscription-item.mapper'
import { makeSyncLineConnectedField } from '@/modules/thinkzap/main/make-sync-line-connected-field'
import {
  hubMessageClient,
  zApiClient,
} from '@/modules/portal/application/subscribe-thinkzap-line'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import {
  resolveHubMessageConnected,
  resolveLineConnectedSource,
} from './resolve-line-connected-backfill'

/**
 * Preenche `UF_CRM_93_CONNECTED` ("Conectado") nos itens da SPA 1146 que já existiam
 * antes de os eventos de conexão passarem a gravar o campo.
 *
 * **Escreve só com `--apply`.** Sem a flag é relatório.
 *
 * Status lido ao vivo no provider: Z-API por `GET /status` da instância; HubMessage
 * pelo agregado da WABA (`connectedCount > 0`), a única leitura que existe sem
 * evento — WABA com mais de um canal pode marcar `Sim` num canal desconectado, e o
 * próximo evento corrige.
 *
 * Idempotente: item que já tem o valor lido é contado como inalterado e não é
 * escrito. A escrita passa pelo repositório com cache, como os eventos.
 */

type RawItem = Record<string, unknown> & { id: string | number }

const SELECT = [
  'id',
  SUBSCRIPTION_ITEM_PROVIDER_FIELD,
  SUBSCRIPTION_ITEM_CONNECTED_FIELD,
  SUBSCRIPTION_ITEM_DELETED_AT_FIELD,
  'ufCrm93ZApiInstanceId',
  'ufCrm93ZApiInstanceToken',
  'ufCrm93HubChanelId',
  'ufCrm93HubWabaId',
]

const text = (raw: unknown): string | undefined => {
  const value = typeof raw === 'string' ? raw.trim() : ''
  return value === '' ? undefined : value
}

async function listAllItems(bitrix: BitrixClient): Promise<RawItem[]> {
  const items: RawItem[] = []
  let start: number | undefined = undefined

  do {
    const response = await bitrix.listCrmItems(
      env.payments.spa.subscriptionItemEntityType,
      {},
      { select: SELECT, ...(start !== undefined && { start }) },
    )
    items.push(...((response.result?.items ?? []) as RawItem[]))
    start = response.next
  } while (start !== undefined)

  return items
}

const label = (connected: boolean | null): string =>
  connected === null ? '(vazio)' : connected ? 'Sim' : 'Não'

async function main(): Promise<void> {
  const apply = process.argv.slice(2).includes('--apply')
  const bitrix = new BitrixClient({ webhook: env.crmthinkWebhookUrl })
  const zApi = zApiClient()
  const hubMessage = hubMessageClient()
  const sync = makeSyncLineConnectedField()

  // Antes de tudo, inclusive no dry-run: campo ausente aborta aqui, e não no
  // primeiro item com o relatório pela metade.
  await ensureSubscriptionItemConnectedField(bitrix)

  const items = await listAllItems(bitrix)
  console.log(
    `Itens na SPA ${env.payments.spa.subscriptionItemEntityType}: ${items.length}`,
  )

  /** Uma chamada só para todas as linhas oficiais; falha vira falha por item. */
  let wabaCounts: Promise<Map<string, number>> | undefined
  const connectedCountByWaba = () =>
    (wabaCounts ??= hubMessage
      .listBusinesses()
      .then(
        ({ items: businesses }) =>
          new Map(businesses.map(b => [b.businessId, b.connectedCount])),
      ))

  let written = 0
  let unchanged = 0
  let failed = 0
  const skipped: Record<string, number> = {}

  for (const raw of items) {
    const itemId = String(raw.id)
    const current = parseConnectedField(raw[SUBSCRIPTION_ITEM_CONNECTED_FIELD])

    const source = resolveLineConnectedSource({
      itemId,
      provider: text(raw[SUBSCRIPTION_ITEM_PROVIDER_FIELD]) ?? '',
      zApiInstanceId: text(raw.ufCrm93ZApiInstanceId),
      zApiInstanceToken: text(raw.ufCrm93ZApiInstanceToken),
      hubmessageChannelId: text(raw.ufCrm93HubChanelId),
      wabaId: text(raw.ufCrm93HubWabaId),
      deleted: Boolean(text(raw[SUBSCRIPTION_ITEM_DELETED_AT_FIELD])),
    })

    if (source.kind === 'skipped') {
      skipped[source.reason] = (skipped[source.reason] ?? 0) + 1
      console.log(`[ignorado] item ${itemId}: ${source.reason}`)
      continue
    }

    let connected: boolean
    try {
      connected =
        source.kind === 'zapi'
          ? (await zApi.getInstanceStatus(source.instanceId, source.token))
              .connected
          : resolveHubMessageConnected(
              source.wabaId,
              await connectedCountByWaba(),
            )
    } catch (error) {
      failed++
      console.warn(`[falhou] status do item ${itemId} (${source.kind}):`, error)
      continue
    }

    if (current === connected) {
      unchanged++
      console.log(`[inalterado] item ${itemId}: ${label(current)}`)
      continue
    }

    if (!apply) {
      written++
      console.log(
        `[dry-run] item ${itemId}: ${label(current)} → ${label(connected)}`,
      )
      continue
    }

    try {
      await sync.execute({ itemId, current, connected })
      written++
      console.log(
        `[gravado] item ${itemId}: ${label(current)} → ${label(connected)}`,
      )
    } catch (error) {
      failed++
      console.error(`[falhou] gravação do item ${itemId}:`, error)
    }
  }

  const ignored = Object.entries(skipped)
    .map(([reason, count]) => `${count} ${reason}`)
    .join(', ')

  console.log(
    `\nResumo${apply ? '' : ' (dry-run)'}: ${written} ${apply ? 'gravado(s)' : 'a gravar'}, ` +
      `${unchanged} inalterado(s), ${ignored || '0 ignorado(s)'}, ${failed} falha(s)`,
  )

  if (!apply) console.log('Nada foi gravado. Rode com --apply para gravar.')
}

// `process.exit` explícito: o repositório com cache abre conexão Redis, que
// seguraria o processo depois do resumo.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Backfill do campo Conectado falhou:', error)
    process.exit(1)
  })
