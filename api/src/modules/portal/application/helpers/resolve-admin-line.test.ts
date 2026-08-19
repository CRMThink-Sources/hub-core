import { describe, expect, it, vi } from 'vitest'
import { AdminAppNotFoundError, resolveAdminLine } from './resolve-admin-line'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { LineNotFoundError } from '@/modules/thinkzap/domain/errors/line-not-found.error'
import { LineProviderNotSupportedError } from '@/modules/thinkzap/domain/errors/line-provider-not-supported.error'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'

const APP = {
  id: 'app-1',
  domainId: 'domain-1',
  appCodeId: 'crmthink.thinkzap',
}

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

const zapi = (id: string) =>
  item(id, {
    provider: 'ZAPI',
    zApiInstanceId: 'Z-1',
    zApiInstanceToken: 'TOKEN',
  })

/** Assinatura já vencida: linha bloqueada, que o admin ainda tem que alcançar. */
const EXPIRED_TRIAL = {
  status: 'trialing',
  currentPeriodEnd: new Date('2020-01-01T00:00:00.000Z'),
}

function makeSut(
  subscriptions: unknown[],
  installedApp: unknown = APP,
): { getById: ReturnType<typeof vi.fn>; deps: never } {
  const getById = vi.fn().mockResolvedValue(installedApp)
  const execute = vi.fn().mockResolvedValue({ subscriptions })

  return {
    getById,
    deps: {
      getApp: { getById },
      getAplicationContext: { execute },
    } as never,
  }
}

describe('resolveAdminLine', () => {
  it('resolve o item da instalação', async () => {
    const { deps } = makeSut([{ status: 'active', items: [zapi('item-1')] }])

    const line = await resolveAdminLine('app-1', 'item-1', deps)

    expect(line.id).toBe('item-1')
  })

  it('não encontra item de outra instalação', async () => {
    const { deps } = makeSut([{ status: 'active', items: [zapi('item-1')] }])

    await expect(
      resolveAdminLine('app-1', 'item-de-outro-cliente', deps),
    ).rejects.toThrow(LineNotFoundError)
  })

  it('recusa item que não é linha', async () => {
    const { deps } = makeSut([
      { status: 'active', items: [item('item-1', { provider: 'NONE' })] },
    ])

    await expect(resolveAdminLine('app-1', 'item-1', deps)).rejects.toThrow(
      LineProviderNotSupportedError,
    )
  })

  it('resolve linha bloqueada por trial vencido', async () => {
    const { deps } = makeSut([{ ...EXPIRED_TRIAL, items: [zapi('item-1')] }])

    const line = await resolveAdminLine('app-1', 'item-1', deps)

    expect(line.id).toBe('item-1')
  })

  it('recusa instalação inexistente', async () => {
    const { deps } = makeSut([], null)

    await expect(resolveAdminLine('app-1', 'item-1', deps)).rejects.toThrow(
      AdminAppNotFoundError,
    )
  })
})
