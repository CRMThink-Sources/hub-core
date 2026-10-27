import { describe, expect, it, vi } from 'vitest'
import type { AplicationContext } from '@/modules/application/application/get-aplication-context'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import {
  LINE_NOT_FOUND_REASON,
  LineLookupUnavailableError,
  resolveLineTarget,
  settleUnresolvedLine,
} from './widget-send-line-target'

const row = {
  id: 'outbox-1',
  domainId: 'domain-1',
  appCode: 'crmthink.thinkzap',
  subscriptionItemId: '77',
}

const item = (metadata: SubscriptionItem['metadata']): SubscriptionItem => ({
  id: '77',
  name: 'Linha 77',
  subscription: 'sub-1',
  status: 'active',
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: '6',
  metadata,
})

const contextWith = (items: SubscriptionItem[]) =>
  ({
    customer: { id: 'domain-1', name: 'querobombinhas.bitrix24.com.br' },
    aplication: { id: 'app-1' },
    subscriptions: [{ id: 'sub-1', status: 'active', items }],
  }) as unknown as AplicationContext

const bitrixDown = new Error('Failed to list CRM items')

describe('resolveLineTarget', () => {
  it('linha Z-API presente no contexto é resolvida com a credencial', async () => {
    const resolution = await resolveLineTarget(row, () =>
      Promise.resolve(
        contextWith([
          item({
            provider: 'ZAPI',
            zApiInstanceId: 'Z-1',
            zApiInstanceToken: 'TOKEN',
          }),
        ]),
      ),
    )

    expect(resolution).toMatchObject({
      kind: 'found',
      line: {
        provider: ConnectorProvider.ZAPI,
        instanceId: 'Z-1',
        zApiToken: 'TOKEN',
        appId: 'app-1',
      },
    })
  })

  it('linha HubMessage é resolvida pelo canal', async () => {
    const resolution = await resolveLineTarget(row, () =>
      Promise.resolve(
        contextWith([
          item({ provider: 'HUBMESSAGE', hubmessageChannelId: 'C-9' }),
        ]),
      ),
    )

    expect(resolution).toMatchObject({
      kind: 'found',
      line: { provider: ConnectorProvider.HUBMESSAGE, channelId: 'C-9' },
    })
  })

  it('contexto lido sem o item é not-found (linha removida)', async () => {
    const resolution = await resolveLineTarget(row, () =>
      Promise.resolve(contextWith([])),
    )

    expect(resolution).toEqual({ kind: 'not-found' })
  })

  it('item sem provider é not-found', async () => {
    const resolution = await resolveLineTarget(row, () =>
      Promise.resolve(contextWith([item({ provider: 'NONE' })])),
    )

    expect(resolution).toEqual({ kind: 'not-found' })
  })

  it('falha ao ler o contexto é unavailable, não not-found', async () => {
    const resolution = await resolveLineTarget(row, () =>
      Promise.reject(bitrixDown),
    )

    expect(resolution).toEqual({ kind: 'unavailable', error: bitrixDown })
  })
})

function makeDeps() {
  return {
    markFailed: vi
      .fn<(id: string, reason: string) => Promise<void>>()
      .mockResolvedValue(undefined),
    notifyFailed: vi.fn().mockResolvedValue(undefined),
    appendJobLog: vi.fn().mockResolvedValue(undefined),
    onUnavailable: vi.fn(),
  }
}

describe('settleUnresolvedLine', () => {
  it('Linha removida da instalação: FAILED na hora, sem retentativa, operador avisado', async () => {
    const deps = makeDeps()

    await expect(
      settleUnresolvedLine(row, { kind: 'not-found' }, false, deps),
    ).resolves.toBe('done')

    expect(deps.markFailed).toHaveBeenCalledWith(
      'outbox-1',
      LINE_NOT_FOUND_REASON,
    )
    expect(deps.notifyFailed).toHaveBeenCalledOnce()
    expect(deps.onUnavailable).not.toHaveBeenCalled()
  })

  it('Bitrix instável na primeira tentativa: relança para o BullMQ, sem marcar nem avisar', async () => {
    const deps = makeDeps()

    await expect(
      settleUnresolvedLine(
        row,
        { kind: 'unavailable', error: bitrixDown },
        false,
        deps,
      ),
    ).rejects.toBeInstanceOf(LineLookupUnavailableError)

    expect(deps.markFailed).not.toHaveBeenCalled()
    expect(deps.notifyFailed).not.toHaveBeenCalled()
    expect(deps.onUnavailable).toHaveBeenCalledWith(bitrixDown, true)
  })

  it('Bitrix fora do ar em todas as tentativas: FAILED com o motivo real e operador avisado', async () => {
    const deps = makeDeps()

    await expect(
      settleUnresolvedLine(
        row,
        { kind: 'unavailable', error: bitrixDown },
        true,
        deps,
      ),
    ).resolves.toBe('done')

    const [, reason] = deps.markFailed.mock.calls[0]!
    expect(reason).toBe(
      'Falha temporária ao consultar a linha: Failed to list CRM items',
    )
    expect(reason).not.toBe(LINE_NOT_FOUND_REASON)
    expect(deps.notifyFailed).toHaveBeenCalledOnce()
    expect(deps.onUnavailable).toHaveBeenCalledWith(bitrixDown, false)
  })
})
