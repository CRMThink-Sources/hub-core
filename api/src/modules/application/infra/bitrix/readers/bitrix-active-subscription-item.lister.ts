import { env } from '@/config/env'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import type { ActiveSubscriptionItemLister } from '@/modules/thinkzap/domain/ports/active-subscription-item-lister.port'
import { SUBSCRIPTION_ITEM_DELETED_AT_FIELD } from '../ensure-subscription-item-deletion-fields'
import {
  STATUS_BY_BITRIX_ID,
  SUBSCRIPTION_PARENT_FIELD,
} from '../mappers/subscription-item.mapper'

const ACTIVE_ITEM_STATUS_ID = Object.entries(STATUS_BY_BITRIX_ID).find(
  ([, status]) => status === 'active',
)?.[0]

/**
 * Todos os itens `active` da SPA 1146 com o pai, numa passada paginada — a
 * reconciliação cruza com as assinaturas ativas em memória, em vez de listar os itens
 * de cada assinatura (uma chamada por assinatura).
 */
export class BitrixActiveSubscriptionItemLister implements ActiveSubscriptionItemLister {
  constructor(private readonly bitrix: Pick<BitrixClient, 'listCrmItems'>) {}

  async listActiveItems(): Promise<
    Array<{ itemId: string; subscriptionId: string | null }>
  > {
    const items: Array<{ itemId: string; subscriptionId: string | null }> = []
    let start: number | undefined

    do {
      const response = await this.bitrix.listCrmItems(
        env.payments.spa.subscriptionItemEntityType,
        { ufCrm93Status: ACTIVE_ITEM_STATUS_ID },
        {
          select: ['id', SUBSCRIPTION_PARENT_FIELD],
          ...(start !== undefined && { start }),
        },
      )

      for (const raw of response.result?.items ?? []) {
        const record = raw as Record<string, unknown>
        const id = record.id
        if (typeof id !== 'number' && typeof id !== 'string') continue

        const parent = record[SUBSCRIPTION_PARENT_FIELD]
        items.push({
          itemId: String(id),
          subscriptionId:
            (typeof parent === 'number' || typeof parent === 'string') &&
            String(parent) !== '0' &&
            String(parent) !== ''
              ? String(parent)
              : null,
        })
      }

      start = response.next
    } while (start !== undefined)

    return items
  }

  async listItemsWithCredential(): Promise<
    Array<{
      itemId: string
      subscriptionId: string | null
      status: 'active' | 'cancelled' | null
    }>
  > {
    const items: Array<{
      itemId: string
      subscriptionId: string | null
      status: 'active' | 'cancelled' | null
    }> = []
    let start: number | undefined

    do {
      const response = await this.bitrix.listCrmItems(
        env.payments.spa.subscriptionItemEntityType,
        {},
        {
          select: [
            'id',
            SUBSCRIPTION_PARENT_FIELD,
            'ufCrm93Status',
            'ufCrm93ZApiInstanceId',
            'ufCrm93HubChanelId',
            SUBSCRIPTION_ITEM_DELETED_AT_FIELD,
          ],
          ...(start !== undefined && { start }),
        },
      )

      for (const raw of response.result?.items ?? []) {
        const record = raw as Record<string, unknown>
        const id = record.id
        if (typeof id !== 'number' && typeof id !== 'string') continue
        if (filled(record[SUBSCRIPTION_ITEM_DELETED_AT_FIELD])) continue
        if (
          !filled(record.ufCrm93ZApiInstanceId) &&
          !filled(record.ufCrm93HubChanelId)
        ) {
          continue
        }

        items.push({
          itemId: String(id),
          subscriptionId: parentOf(record[SUBSCRIPTION_PARENT_FIELD]),
          status: STATUS_BY_BITRIX_ID[String(record.ufCrm93Status)] ?? null,
        })
      }

      start = response.next
    } while (start !== undefined)

    return items
  }
}

const filled = (raw: unknown): boolean =>
  typeof raw === 'string' && raw.trim() !== ''

const parentOf = (raw: unknown): string | null =>
  (typeof raw === 'number' || typeof raw === 'string') &&
  String(raw) !== '0' &&
  String(raw) !== ''
    ? String(raw)
    : null
