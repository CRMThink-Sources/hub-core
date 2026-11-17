import { env } from '@/config/env'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import type { ActiveResourceUsage } from '@/modules/thinkzap/domain/ports/active-resource-usage.port'
import { SUBSCRIPTION_ITEM_DELETED_AT_FIELD } from '../ensure-subscription-item-deletion-fields'
import {
  STATUS_BY_BITRIX_ID,
  SUBSCRIPTION_PARENT_FIELD,
} from '../mappers/subscription-item.mapper'
import { BITRIX_ID_BY_STATUS as SUBSCRIPTION_STATUS_ID } from '../mappers/subscription.mapper'

const ACTIVE_ITEM_STATUS_ID = Object.entries(STATUS_BY_BITRIX_ID).find(
  ([, status]) => status === 'active',
)?.[0]

const CREDENTIAL_FIELD = {
  ZAPI: 'ufCrm93ZApiInstanceId',
  HUBMESSAGE: 'ufCrm93HubChanelId',
} as const

export class BitrixActiveResourceUsageReader implements ActiveResourceUsage {
  constructor(private readonly bitrix: Pick<BitrixClient, 'listCrmItems'>) {}

  async listOtherActiveItemIds(
    resource: { provider: 'ZAPI' | 'HUBMESSAGE'; instanceId: string },
    exceptItemId: string,
  ): Promise<string[]> {
    const candidates: { id: string; parentId: string | null }[] = []
    let start: number | undefined

    do {
      const response = await this.bitrix.listCrmItems(
        env.payments.spa.subscriptionItemEntityType,
        {
          [`=${CREDENTIAL_FIELD[resource.provider]}`]: resource.instanceId,
          ufCrm93Status: ACTIVE_ITEM_STATUS_ID,
        },
        {
          select: [
            'id',
            SUBSCRIPTION_PARENT_FIELD,
            SUBSCRIPTION_ITEM_DELETED_AT_FIELD,
          ],
          ...(start !== undefined && { start }),
        },
      )

      for (const raw of response.result?.items ?? []) {
        const record = raw as Record<string, unknown>
        const id = record.id
        if (typeof id !== 'number' && typeof id !== 'string') continue
        if (String(id) === exceptItemId) continue

        const deletedAt = record[SUBSCRIPTION_ITEM_DELETED_AT_FIELD]
        if (typeof deletedAt === 'string' && deletedAt.trim() !== '') continue

        const parent = record[SUBSCRIPTION_PARENT_FIELD]
        const parentId =
          typeof parent === 'number' || typeof parent === 'string'
            ? String(parent)
            : null
        candidates.push({
          id: String(id),
          parentId: parentId && parentId !== '0' ? parentId : null,
        })
      }

      start = response.next
    } while (start !== undefined)

    const cancelledParents = await this.cancelledAmong(
      candidates.flatMap(c => (c.parentId ? [c.parentId] : [])),
    )

    /**
     * Linha "ativa" sob assinatura cancelada não é uso: o cliente saiu, e contá-la faria
     * duas linhas de contratos encerrados protegerem uma à outra para sempre.
     */
    return candidates
      .filter(c => !(c.parentId && cancelledParents.has(c.parentId)))
      .map(c => c.id)
  }

  private async cancelledAmong(parentIds: string[]): Promise<Set<string>> {
    const cancelled = new Set<string>()
    if (parentIds.length === 0) return cancelled

    let start: number | undefined
    do {
      const response = await this.bitrix.listCrmItems(
        env.payments.spa.subscriptionEntityType,
        {
          '@id': [...new Set(parentIds)],
          ufCrm91Status: SUBSCRIPTION_STATUS_ID.cancelled,
        },
        { select: ['id'], ...(start !== undefined && { start }) },
      )
      for (const raw of response.result?.items ?? []) {
        const id = (raw as Record<string, unknown>).id
        if (typeof id === 'number' || typeof id === 'string') {
          cancelled.add(String(id))
        }
      }
      start = response.next
    } while (start !== undefined)

    return cancelled
  }
}
