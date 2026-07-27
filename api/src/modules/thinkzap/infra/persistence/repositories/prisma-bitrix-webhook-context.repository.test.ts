import { beforeEach, describe, expect, it, vi } from 'vitest'

const { findFirstMock } = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
}))

vi.mock('@/config/prisma.js', () => ({
  prisma: { domain: { findFirst: findFirstMock } },
}))

import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { PrismaBitrixWebhookContextRepository } from './prisma-bitrix-webhook-context.repository'

const params = {
  domainName: 'acme.bitrix24.com',
  appCode: 'app-code-thinkzap',
  line: '10',
}

function makeRow(
  connector: { provider: string } | null,
  instanceOverride: Record<string, unknown> = {},
) {
  return {
    id: 'domain-1',
    name: 'acme.bitrix24.com',
    memberId: 'member-1',
    apps: [
      {
        id: 'app-1',
        domainId: 'domain-1',
        appCodeId: 'app-code-thinkzap',
        status: 'ACTIVE',
        credential: { id: 'cred-1' },
      },
    ],
    instances: [
      {
        id: 'inst-db-1',
        instanceId: 'INST-A',
        zApiToken: 'token',
        channelId: null,
        vinculatedChannel: '10',
        domainId: 'domain-1',
        status: 'CONNECTED',
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        connector,
        ...instanceOverride,
      },
    ],
  }
}

describe('PrismaBitrixWebhookContextRepository', () => {
  const repo = new PrismaBitrixWebhookContextRepository()

  beforeEach(() => {
    findFirstMock.mockReset()
  })

  it('carrega o conector da instância na query', async () => {
    findFirstMock.mockResolvedValue(makeRow({ provider: 'ZAPI' }))

    await repo.getContext(params)

    expect(findFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          instances: expect.objectContaining({
            include: { connector: true },
          }),
        }),
      }),
    )
  })

  it('instância com conector HubMessage devolve provider e channelId', async () => {
    findFirstMock.mockResolvedValue(
      makeRow({ provider: 'HUBMESSAGE' }, { channelId: 'CH-123' }),
    )

    const context = await repo.getContext(params)

    expect(context?.connector.provider).toBe(ConnectorProvider.HUBMESSAGE)
    expect(context?.instance.channelId).toBe('CH-123')
  })

  it('instância sem conector associado devolve provider ZAPI', async () => {
    findFirstMock.mockResolvedValue(makeRow(null))

    const context = await repo.getContext(params)

    expect(context?.connector.provider).toBe(ConnectorProvider.ZAPI)
  })

  it('domínio não encontrado devolve null', async () => {
    findFirstMock.mockResolvedValue(null)

    await expect(repo.getContext(params)).resolves.toBeNull()
  })
})
