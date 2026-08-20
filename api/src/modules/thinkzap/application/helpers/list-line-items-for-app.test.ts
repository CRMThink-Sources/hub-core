import { describe, expect, it, vi } from 'vitest'
import {
  entitlementsByItemId,
  listLineItemsForApp,
  providerLineId,
} from './list-line-items-for-app'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'

const item = (
  id: string,
  metadata: SubscriptionItem['metadata'],
): SubscriptionItem => ({
  id,
  name: `Linha ${id}`,
  subscription: 'sub-1',
  status: 'active',
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: null,
  metadata,
})

const zapi = (id: string, instanceId = 'Z-1') =>
  item(id, {
    provider: 'ZAPI',
    zApiInstanceId: instanceId,
    zApiInstanceToken: 'TOKEN',
  })

const hub = (id: string, channelId = 'C-9') =>
  item(id, {
    provider: 'HUBMESSAGE',
    hubmessageChannelId: channelId,
    wabaId: 'W-9',
  })

const none = (id: string) => item(id, { provider: 'NONE' })

function makeSut(items: SubscriptionItem[], installedApp: unknown = APP) {
  const getById = vi.fn().mockResolvedValue(installedApp)
  const execute = vi.fn().mockResolvedValue({
    subscriptions: [{ items }],
  })

  return {
    getById,
    execute,
    list: () =>
      listLineItemsForApp('app-1', {
        getApp: { getById } as never,
        getAplicationContext: { execute } as never,
      }),
  }
}

const APP = {
  id: 'app-1',
  domainId: 'domain-1',
  appCodeId: 'crmthink.thinkzap',
}

describe('listLineItemsForApp', () => {
  it('devolve as linhas da instalação com o par (domainId, appCode)', async () => {
    const sut = makeSut([zapi('i1'), hub('i2')])

    await expect(sut.list()).resolves.toEqual({
      domainId: 'domain-1',
      appCode: 'crmthink.thinkzap',
      items: [zapi('i1'), hub('i2')],
      subscriptions: [{ items: [zapi('i1'), hub('i2')] }],
    })
    expect(sut.execute).toHaveBeenCalledWith({
      domainId: 'domain-1',
      appCode: 'crmthink.thinkzap',
    })
  })

  /** Item de cobrança sem conector é assinatura sem linha, não linha sem config. */
  it('descarta item NONE', async () => {
    const sut = makeSut([zapi('i1'), none('i2')])

    const result = await sut.list()

    expect(result?.items.map(i => i.id)).toEqual(['i1'])
  })

  it('devolve null quando a instalação não existe, sem ler contexto', async () => {
    const sut = makeSut([zapi('i1')], null)

    await expect(sut.list()).resolves.toBeNull()
    expect(sut.execute).not.toHaveBeenCalled()
  })

  /**
   * O ponto da migração: a lista não passa por `Connector`, então linha sem row
   * naquela tabela aparece. Antes ela era invisível — sem erro e sem log.
   */
  it('não consulta Connector nem Instance', async () => {
    const sut = makeSut([zapi('i1')])

    await sut.list()

    expect(sut.getById).toHaveBeenCalledExactlyOnceWith('app-1')
    expect(sut.execute).toHaveBeenCalledTimes(1)
  })

  it('lista itens de assinaturas diferentes', async () => {
    const getById = vi.fn().mockResolvedValue(APP)
    const execute = vi.fn().mockResolvedValue({
      subscriptions: [{ items: [zapi('i1')] }, { items: [hub('i2')] }],
    })

    const result = await listLineItemsForApp('app-1', {
      getApp: { getById } as never,
      getAplicationContext: { execute } as never,
    })

    expect(result?.items.map(i => i.id)).toEqual(['i1', 'i2'])
  })
})

/**
 * O portal admin precisa do entitlement por linha, e a travessia que monta `items`
 * descarta a assinatura pai. Este mapa é o que preserva o par.
 */
describe('entitlementsByItemId', () => {
  const DAY = 24 * 60 * 60 * 1000
  const now = new Date('2026-08-04T12:00:00.000Z')

  it('aplica o entitlement da assinatura a todos os itens dela', () => {
    const map = entitlementsByItemId(
      [
        {
          id: 'sub-1',
          status: 'trialing',
          currentPeriodEnd: new Date(now.getTime() - DAY),
          items: [zapi('i1'), hub('i2')],
        },
      ] as never,
      now,
    )

    expect(map).toEqual({ i1: 'trial-expired', i2: 'trial-expired' })
  })

  it('resolve assinaturas diferentes de forma independente', () => {
    const map = entitlementsByItemId(
      [
        {
          id: 'sub-1',
          status: 'active',
          currentPeriodEnd: now,
          items: [zapi('i1')],
        },
        {
          id: 'sub-2',
          status: 'cancelled',
          currentPeriodEnd: now,
          items: [hub('i2')],
        },
      ] as never,
      now,
    )

    expect(map).toEqual({ i1: 'active', i2: 'inactive' })
  })

  it('devolve mapa vazio sem assinaturas', () => {
    expect(entitlementsByItemId([], now)).toEqual({})
  })
})

describe('providerLineId', () => {
  it('devolve o id da instância na Z-API', () => {
    expect(providerLineId(zapi('i1', 'Z-42'))).toBe('Z-42')
  })

  /** HubMessage é chaveada pelo canal: é o que o webhook entrega e a âncora guarda. */
  it('devolve o id do canal na HubMessage', () => {
    expect(providerLineId(hub('i2', 'C-42'))).toBe('C-42')
  })

  it('devolve null para item sem conector', () => {
    expect(providerLineId(none('i3'))).toBeNull()
  })
})
