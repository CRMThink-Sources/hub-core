import { beforeEach, describe, expect, it, vi } from 'vitest'

const { findFirstMock } = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
}))

vi.mock('@/config/prisma.js', () => ({
  prisma: { domain: { findFirst: findFirstMock } },
}))

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { PrismaBitrixWebhookContextRepository } from './prisma-bitrix-webhook-context.repository'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'

const params = {
  domainName: 'acme.bitrix24.com',
  appCode: 'app-code-thinkzap',
  line: '10',
}

const domainRow = {
  id: 'domain-1',
  name: 'acme.bitrix24.com',
  memberId: 'member-1',
  apps: [
    {
      id: 'app-1',
      domainId: 'domain-1',
      appCodeId: 'app-code-thinkzap',
      status: 'ACTIVE',
      credential: { id: 'cred-1', accessToken: 'at-1' },
    },
  ],
}

const zapiItem = (
  vinculatedChannel: string | null,
  settings = DEFAULT_CONNECTOR_SETTINGS,
): SubscriptionItem => ({
  id: 'i1',
  name: 'Linha comercial',
  subscription: 'sub-1',
  status: 'active',
  settings: { ...settings },
  vinculatedChannel,
  metadata: {
    provider: 'ZAPI',
    zApiInstanceId: 'INST-A',
    zApiInstanceToken: 'TOKEN-SECRETO',
  },
})

const hubItem = (vinculatedChannel: string | null): SubscriptionItem => ({
  ...zapiItem(vinculatedChannel),
  id: 'i2',
  metadata: {
    provider: 'HUBMESSAGE',
    hubmessageChannelId: 'CH-123',
    wabaId: 'W-9',
  },
})

const anchor = {
  id: 'inst-db-1',
  instanceId: 'INST-A',
  zApiToken: 'token',
  channelId: null,
  vinculatedChannel: null,
  domainId: 'domain-1',
  status: 'CONNECTED',
  settings: {},
  createdAt: new Date(),
  updatedAt: new Date(),
}

function makeSut(items: SubscriptionItem[] = [zapiItem('10')]) {
  const execute = vi.fn().mockResolvedValue({
    customer: { id: 'domain-1', name: 'acme.bitrix24.com' },
    aplication: { id: 'app-1', spaId: '42' },
    subscriptions: [{ id: 'sub-1', items }],
  })
  const getInstanceByInstanceId = vi.fn().mockResolvedValue(anchor)
  const getInstanceByChannelId = vi
    .fn()
    .mockResolvedValue({ ...anchor, channelId: 'CH-123' })
  const create = vi.fn().mockResolvedValue({ ...anchor, id: 'inst-novo' })

  return {
    execute,
    getInstanceByInstanceId,
    getInstanceByChannelId,
    create,
    repo: new PrismaBitrixWebhookContextRepository(
      { execute } as never,
      {
        getInstanceByInstanceId,
        getInstanceByChannelId,
        create,
      } as never,
    ),
  }
}

describe('PrismaBitrixWebhookContextRepository', () => {
  beforeEach(() => {
    findFirstMock.mockReset()
    findFirstMock.mockResolvedValue(domainRow)
  })

  /**
   * A mudança central: a linha é achada pelo item cujo `vinculatedChannel` casa com
   * o canal do evento. Antes era `where: { vinculatedChannel }` na tabela, com o
   * vínculo espelhado — editar o campo no CRM fazia item e row divergirem e a
   * mensagem roteava pelo canal antigo.
   */
  it('resolve a linha pelo item, sem filtrar instância por canal', async () => {
    const sut = makeSut()

    const context = await sut.repo.getContext(params)

    expect(context?.instance.vinculatedChannel).toBe('10')
    expect(findFirstMock.mock.calls[0]?.[0]).not.toHaveProperty(
      'include.instances',
    )
  })

  it('escopa o contexto pelo domínio e appCode do evento', async () => {
    const sut = makeSut()

    await sut.repo.getContext(params)

    expect(sut.execute).toHaveBeenCalledWith({
      domainId: 'domain-1',
      appCode: 'app-code-thinkzap',
    })
  })

  it('devolve os settings do item, não da coluna da instância', async () => {
    const sut = makeSut([
      zapiItem('10', {
        ...DEFAULT_CONNECTOR_SETTINGS,
        prefixOperatorNameEnabled: true,
      }),
    ])

    const context = await sut.repo.getContext(params)

    expect(context?.instance.settings.prefixOperatorNameEnabled).toBe(true)
  })

  it('devolve o provider do item', async () => {
    const sut = makeSut([hubItem('10')])

    const context = await sut.repo.getContext(params)

    expect(context?.connector.provider).toBe(ConnectorProvider.HUBMESSAGE)
    expect(sut.getInstanceByChannelId).toHaveBeenCalledWith('CH-123')
  })

  /** Linha Z-API nascida na SPA: a âncora é criada para a mensagem ter FK. */
  it('cria a âncora quando a linha Z-API não tem registro', async () => {
    const sut = makeSut()
    sut.getInstanceByInstanceId.mockResolvedValue(null)

    const context = await sut.repo.getContext(params)

    expect(sut.create).toHaveBeenCalled()
    expect(context?.instance.id).toBe('inst-novo')
  })

  /** HubMessage não cria: `wabaId` e `phoneId` só o fluxo de conexão conhece. */
  it('não cria âncora para HubMessage sem registro', async () => {
    const sut = makeSut([hubItem('10')])
    sut.getInstanceByChannelId.mockResolvedValue(null)

    await expect(sut.repo.getContext(params)).resolves.toBeNull()
    expect(sut.create).not.toHaveBeenCalled()
  })

  it('devolve null quando nenhum item está vinculado ao canal', async () => {
    const sut = makeSut([zapiItem('999')])

    await expect(sut.repo.getContext(params)).resolves.toBeNull()
  })

  it('devolve null quando a instalação não tem item nenhum', async () => {
    const sut = makeSut([])

    await expect(sut.repo.getContext(params)).resolves.toBeNull()
  })

  it('domínio não encontrado devolve null', async () => {
    findFirstMock.mockResolvedValue(null)
    const sut = makeSut()

    await expect(sut.repo.getContext(params)).resolves.toBeNull()
    expect(sut.execute).not.toHaveBeenCalled()
  })

  /** Credencial inutilizável falha alto, perto da causa. */
  it('lança quando o app não tem accessToken', async () => {
    findFirstMock.mockResolvedValue({
      ...domainRow,
      apps: [{ ...domainRow.apps[0], credential: { accessToken: null } }],
    })
    const sut = makeSut()

    await expect(sut.repo.getContext(params)).rejects.toThrow(
      /sem credencial utilizável/,
    )
  })
})
