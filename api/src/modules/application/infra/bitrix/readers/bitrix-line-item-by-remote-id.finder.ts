import { env } from '@/config/env'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import type {
  LineItemByRemoteIdFinder,
  LineItemConnectionTarget,
} from '@/modules/thinkzap/domain/ports/line-item-by-remote-id-finder.port'
import { SUBSCRIPTION_ITEM_CONNECTED_FIELD } from '../ensure-subscription-item-connected-field'
import { SUBSCRIPTION_ITEM_DELETED_AT_FIELD } from '../ensure-subscription-item-deletion-fields'
import { parseConnectedField } from '../mappers/subscription-item.mapper'

const SELECT = [
  'id',
  SUBSCRIPTION_ITEM_CONNECTED_FIELD,
  SUBSCRIPTION_ITEM_DELETED_AT_FIELD,
  'ufCrm93ZApiInstanceToken',
]

type RawItem = Record<string, unknown>

const text = (raw: unknown): string | undefined => {
  const value = typeof raw === 'string' ? raw.trim() : ''
  return value === '' ? undefined : value
}

/**
 * Filtro direto por credencial na SPA 1146, lendo campos crus em vez de passar pelo
 * mapper de domínio: o mapper recusa item incoerente, e um item com credencial
 * torta ainda é a linha daquele evento — reprovar aqui esconderia o campo de
 * conexão justamente de quem o suporte precisa ver.
 */
export class BitrixLineItemByRemoteIdFinder implements LineItemByRemoteIdFinder {
  constructor(
    private readonly bitrix: BitrixClient,
    private readonly entityTypeId: number = env.payments.spa
      .subscriptionItemEntityType,
  ) {}

  findLiveByZApiInstanceId(instanceId: string) {
    return this.findLive({ '=ufCrm93ZApiInstanceId': instanceId })
  }

  findLiveByHubMessageChannelId(channelId: string) {
    return this.findLive({ '=ufCrm93HubChanelId': channelId })
  }

  private async findLive(
    filter: Record<string, unknown>,
  ): Promise<LineItemConnectionTarget[]> {
    const items: RawItem[] = []
    let start: number | undefined = undefined

    // Pagina mesmo esperando um item só: duplicidade é exatamente o caso que o
    // chamador precisa enxergar inteiro.
    do {
      const response = await this.bitrix.listCrmItems(
        this.entityTypeId,
        filter,
        {
          select: SELECT,
          ...(start !== undefined && { start }),
        },
      )
      items.push(...((response.result?.items ?? []) as RawItem[]))
      start = response.next
    } while (start !== undefined)

    return items
      .filter(item => !text(item[SUBSCRIPTION_ITEM_DELETED_AT_FIELD]))
      .map(item => {
        const token = text(item.ufCrm93ZApiInstanceToken)
        return {
          id: String(item.id),
          connected: parseConnectedField(
            item[SUBSCRIPTION_ITEM_CONNECTED_FIELD],
          ),
          ...(token ? { zApiInstanceToken: token } : {}),
        }
      })
  }
}
