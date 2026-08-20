import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { LineProviderNotSupportedError } from '@/modules/thinkzap/domain/errors/line-provider-not-supported.error'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'

const zApi = {
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  updateInstance: vi.fn(),
}

const hubMessage = {
  subscribeChannel: vi.fn(),
  cancelChannel: vi.fn(),
}

vi.mock('@/modules/thinkzap/infra/clients/z-api.client', () => ({
  ZApiClient: class {
    subscribe = zApi.subscribe
    unsubscribe = zApi.unsubscribe
    updateInstance = zApi.updateInstance
  },
}))

vi.mock('@/modules/thinkzap/infra/clients/hubmessage.client', () => ({
  HubMessageClient: class {
    subscribeChannel = hubMessage.subscribeChannel
    cancelChannel = hubMessage.cancelChannel
  },
}))

/**
 * `env` **não** é mockado: os dois clients são, então os valores de credencial nunca
 * chegam a ser usados — e mockar `env` aqui quebraria a cadeia de import de
 * `makeGetAplicationContext`, que passa por `redis-connection`.
 */
import {
  ThinkzapLineCredentialMissingError,
  subscribeThinkzapLine,
} from './subscribe-thinkzap-line'
import { unsubscribeThinkzapLine } from './unsubscribe-thinkzap-line'
import { updateThinkzapLineName } from './update-thinkzap-line-name'
import {
  ThinkzapLineNotInactiveError,
  reactivateThinkzapLine,
} from './reactivate-thinkzap-line'

const APP = {
  id: 'app-1',
  domainId: 'domain-1',
  appCodeId: 'crmthink.thinkzap',
}

const item = (
  metadata: SubscriptionItem['metadata'],
  status: SubscriptionItem['status'] = 'active',
): SubscriptionItem => ({
  id: 'item-1',
  name: 'Linha',
  subscription: 'sub-1',
  status,
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: null,
  metadata,
})

const ZAPI_ITEM = item({
  provider: 'ZAPI',
  zApiInstanceId: 'Z-1',
  zApiInstanceToken: 'TOKEN',
})

const HUB_ITEM = item({
  provider: 'HUBMESSAGE',
  hubmessageChannelId: 'C-9',
  wabaId: 'W-9',
})

const deps = (lineItem: SubscriptionItem) =>
  ({
    getApp: { getById: vi.fn().mockResolvedValue(APP) },
    getAplicationContext: {
      execute: vi.fn().mockResolvedValue({
        subscriptions: [{ status: 'active', items: [lineItem] }],
      }),
    },
  }) as never

beforeEach(() => {
  vi.clearAllMocks()
})

describe('subscribeThinkzapLine', () => {
  it('assina a instância Z-API com a credencial do item', async () => {
    await subscribeThinkzapLine('app-1', 'item-1', deps(ZAPI_ITEM))

    expect(zApi.subscribe).toHaveBeenCalledWith('Z-1', 'TOKEN')
    expect(hubMessage.subscribeChannel).not.toHaveBeenCalled()
  })

  it('assina o canal HubMessage e não toca no Z-API', async () => {
    await subscribeThinkzapLine('app-1', 'item-1', deps(HUB_ITEM))

    expect(hubMessage.subscribeChannel).toHaveBeenCalledWith('C-9')
    expect(zApi.subscribe).not.toHaveBeenCalled()
  })

  it('recusa item Z-API sem token, sem chamar o provider', async () => {
    const semToken = item({
      provider: 'ZAPI',
      zApiInstanceId: 'Z-1',
      zApiInstanceToken: '',
    })

    await expect(
      subscribeThinkzapLine('app-1', 'item-1', deps(semToken)),
    ).rejects.toThrow(ThinkzapLineCredentialMissingError)
    expect(zApi.subscribe).not.toHaveBeenCalled()
  })
})

describe('unsubscribeThinkzapLine', () => {
  it('cancela a instância Z-API', async () => {
    await unsubscribeThinkzapLine('app-1', 'item-1', deps(ZAPI_ITEM))

    expect(zApi.unsubscribe).toHaveBeenCalledWith('Z-1', 'TOKEN')
  })

  it('cancela o canal HubMessage', async () => {
    await unsubscribeThinkzapLine('app-1', 'item-1', deps(HUB_ITEM))

    expect(hubMessage.cancelChannel).toHaveBeenCalledWith(
      'C-9',
      'Cancelamento de assinatura',
    )
  })
})

describe('updateThinkzapLineName', () => {
  it('renomeia a instância Z-API', async () => {
    await updateThinkzapLineName(
      'app-1',
      'item-1',
      'Comercial',
      deps(ZAPI_ITEM),
    )

    expect(zApi.updateInstance).toHaveBeenCalledWith(
      'Z-1',
      'Comercial',
      'TOKEN',
    )
  })

  it('recusa linha oficial sem chamada de rede', async () => {
    await expect(
      updateThinkzapLineName('app-1', 'item-1', 'Comercial', deps(HUB_ITEM)),
    ).rejects.toThrow(LineProviderNotSupportedError)
    expect(zApi.updateInstance).not.toHaveBeenCalled()
    expect(hubMessage.cancelChannel).not.toHaveBeenCalled()
  })
})

describe('reactivateThinkzapLine', () => {
  it('grava apenas o status no item cancelado', async () => {
    const cancelado = item(ZAPI_ITEM.metadata, 'cancelled')
    const updateSubscriptionItem = vi
      .fn()
      .mockResolvedValue({ ...cancelado, status: 'active' })

    const result = await reactivateThinkzapLine(
      'app-1',
      'item-1',
      deps(cancelado),
      { updateSubscriptionItem } as never,
    )

    expect(updateSubscriptionItem).toHaveBeenCalledWith('item-1', {
      status: 'active',
    })
    expect(result.status).toBe('active')
  })

  it('recusa item já ativo sem escrever na SPA', async () => {
    const updateSubscriptionItem = vi.fn()

    await expect(
      reactivateThinkzapLine('app-1', 'item-1', deps(ZAPI_ITEM), {
        updateSubscriptionItem,
      } as never),
    ).rejects.toThrow(ThinkzapLineNotInactiveError)
    expect(updateSubscriptionItem).not.toHaveBeenCalled()
  })
})
