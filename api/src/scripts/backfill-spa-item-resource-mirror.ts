import 'dotenv/config'

import { env } from '@/config/env'
import { RedisSpaItemResourceMirrorRepository } from '@/modules/application/infra/cache/redis-spa-item-resource-mirror.repository'
import { SUBSCRIPTION_ITEM_PROVIDER_FIELD } from '@/modules/application/infra/bitrix/ensure-subscription-item-provider-field'
import { SUBSCRIPTION_PARENT_FIELD } from '@/modules/application/infra/bitrix/mappers/subscription-item.mapper'
import { redisConnection } from '@/queue/redis-connection'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { resolveMirrorBackfill } from './resolve-spa-item-resource-mirror-backfill'

/**
 * Grava o espelho do recurso (`payments:spa-item-resource:v1:<itemId>`) para as linhas que
 * existiam antes de o espelho passar a ser escrito no provisionamento.
 *
 * Sem ele, o caminho de exclusão de item só protege linha criada depois do deploy: toda
 * linha viva hoje seria registrada como recurso órfão na hora em que fosse apagada.
 *
 * **Escreve só com `--apply`.** Sem a flag é relatório, como nos outros backfills deste
 * repo: o default seguro é não tocar em nada.
 *
 * **Idempotente:** rodar de novo regrava o mesmo valor. O que ele nunca grava é a marca de
 * desassinado — ver `resolveMirrorBackfill`.
 *
 * **Pagina a listagem.** `crm.item.list` devolve 50 itens por página e sinaliza a seguinte
 * em `next`; sem seguir o cursor, o backfill cobriria os 50 primeiros itens e reportaria
 * sucesso — que é exatamente o silêncio que ele existe para acabar.
 */

function parseArgs(): { apply: boolean } {
  return { apply: process.argv.slice(2).includes('--apply') }
}

type RawItem = Record<string, unknown> & { id: string }

/** Os campos crus que a resolução usa. `select` explícito: o resto é peso na resposta. */
const SELECT = [
  'id',
  SUBSCRIPTION_ITEM_PROVIDER_FIELD,
  SUBSCRIPTION_PARENT_FIELD,
  'ufCrm93ZApiInstanceId',
  'ufCrm93ZApiInstanceToken',
  'ufCrm93HubChanelId',
]

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

/** Mesma normalização do leitor cru: vazio é ausência, caixa não importa. */
const text = (raw: unknown): string | undefined => {
  const value = typeof raw === 'string' ? raw.trim() : ''

  return value === '' ? undefined : value
}

const parentOf = (raw: unknown): string | null => {
  if (typeof raw === 'number') return raw > 0 ? String(raw) : null
  if (typeof raw === 'string') {
    const value = raw.trim()
    return value !== '' && value !== '0' ? value : null
  }

  return null
}

async function main(): Promise<void> {
  const { apply } = parseArgs()
  const bitrix = new BitrixClient({ webhook: env.crmthinkWebhookUrl })
  const mirrors = new RedisSpaItemResourceMirrorRepository(redisConnection)

  const items = await listAllItems(bitrix)
  console.log(`Itens na SPA ${env.payments.spa.subscriptionItemEntityType}: ${items.length}`)

  let written = 0
  let failed = 0
  const skipped: Record<string, number> = {}

  for (const raw of items) {
    const outcome = resolveMirrorBackfill({
      id: String(raw.id),
      provider: String(raw[SUBSCRIPTION_ITEM_PROVIDER_FIELD] ?? '')
        .trim()
        .toUpperCase(),
      credentials: {
        ...(text(raw.ufCrm93ZApiInstanceId) && {
          zApiInstanceId: text(raw.ufCrm93ZApiInstanceId),
        }),
        ...(text(raw.ufCrm93ZApiInstanceToken) && {
          zApiInstanceToken: text(raw.ufCrm93ZApiInstanceToken),
        }),
        ...(text(raw.ufCrm93HubChanelId) && {
          hubmessageChannelId: text(raw.ufCrm93HubChanelId),
        }),
      },
      subscriptionId: parentOf(raw[SUBSCRIPTION_PARENT_FIELD]),
    })

    if (outcome.kind === 'skipped') {
      skipped[outcome.reason] = (skipped[outcome.reason] ?? 0) + 1
      console.log(`[ignorado] item ${outcome.itemId}: ${outcome.reason}`)
      continue
    }

    if (!apply) {
      console.log(
        `[dry-run] item ${outcome.itemId} → ${outcome.mirror.provider} ${outcome.mirror.instanceId} (assinatura ${outcome.mirror.subscriptionId})`,
      )
      written++
      continue
    }

    try {
      await mirrors.save(outcome.itemId, outcome.mirror)
      written++
      console.log(
        `[gravado] item ${outcome.itemId} → ${outcome.mirror.provider} ${outcome.mirror.instanceId}`,
      )
    } catch (error) {
      failed++
      console.error(`[falhou] item ${outcome.itemId}:`, error)
    }
  }

  const ignored = Object.entries(skipped)
    .map(([reason, count]) => `${count} ${reason}`)
    .join(', ')

  console.log(
    `\nResumo${apply ? '' : ' (dry-run)'}: ${written} espelho(s), ` +
      `${ignored || '0 ignorado(s)'}, ${failed} falha(s)`,
  )

  if (!apply) {
    console.log('Nada foi gravado. Rode com --apply para gravar.')
  }

  await redisConnection.quit()
}

void main().catch(error => {
  console.error('Backfill do espelho do recurso falhou:', error)
  process.exit(1)
})
