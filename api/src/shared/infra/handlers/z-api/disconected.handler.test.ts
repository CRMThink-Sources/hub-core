import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getInstanceByInstanceIdMock,
  getDomainByIdMock,
  getByAppCodeAndDomainIdMock,
  notifyServiceGetMock,
  notifyMock,
  emitMock,
  toMock,
} = vi.hoisted(() => ({
  getInstanceByInstanceIdMock: vi.fn(),
  getDomainByIdMock: vi.fn(),
  getByAppCodeAndDomainIdMock: vi.fn(),
  notifyServiceGetMock: vi.fn(),
  notifyMock: vi.fn(),
  emitMock: vi.fn(),
  toMock: vi.fn(),
}))

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/shared/infra/socket', () => ({
  getIo: () => ({ to: toMock.mockReturnValue({ emit: emitMock }) }),
}))

vi.mock(
  '@/modules/thinkzap/infra/persistence/repositories/prisma-instance.repository',
  () => ({
    PrismaInstanceRepository: class {
      getInstanceByInstanceId = getInstanceByInstanceIdMock
    },
  }),
)

vi.mock('@/shared/infra/persistence/repositories/prisma-domain.repository', () => ({
  PrismaDomainRepository: class {
    getDomainById = getDomainByIdMock
  },
}))

vi.mock(
  '@/shared/infra/persistence/repositories/prisma-installed-app.repository',
  () => ({
    PrismaInstalledAppRepository: class {
      getByAppCodeAndDomainId = getByAppCodeAndDomainIdMock
    },
  }),
)

vi.mock('@/shared/main/make-bitrix-client', () => ({
  makeBitrixClientByDomainAndAppCoode: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/shared/app-catalog/app-catalog', () => ({
  thinkzapAppCodeId: () => 'crmthink.thinkzap',
}))

vi.mock(
  '@/modules/thinkzap/application/thinkzap-disconnect-notify-settings.service',
  () => ({
    ThinkzapDisconnectNotifySettingsService: class {
      get = notifyServiceGetMock
    },
  }),
)

vi.mock('@/shared/application/bitrix-system-notification.service', () => ({
  BitrixSystemNotificationService: class {
    notify = notifyMock
  },
}))

import { ZApiDisconectedHandler } from './disconected.handler'

const event = (overrides: Record<string, unknown> = {}) =>
  ({
    type: 'DisconnectedCallback',
    instanceId: 'Z-1',
    disconnected: true,
    momment: 1789991068459,
    error:
      'It was not possible to restore a session with the current token, please login again',
    ...overrides,
  }) as never

describe('ZApiDisconectedHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getInstanceByInstanceIdMock.mockResolvedValue({
      id: 'inst-db-1',
      instanceId: 'Z-1',
      domainId: 'domain-1',
    })
    getDomainByIdMock.mockResolvedValue({
      id: 'domain-1',
      name: 'acme.bitrix24.com.br',
    })
    getByAppCodeAndDomainIdMock.mockResolvedValue({ id: 'app-1' })
    notifyServiceGetMock.mockResolvedValue([])
    notifyMock.mockResolvedValue(true)
  })

  const handle = (overrides: Record<string, unknown> = {}) =>
    new ZApiDisconectedHandler().handle(event(overrides))

  it('sempre emite o socket connector:disconnected para a sala da instância', async () => {
    await handle()

    expect(toMock).toHaveBeenCalledWith('Z-1')
    expect(emitMock).toHaveBeenCalledWith('connector:disconnected', {
      status: 'disconnected',
    })
  })

  it('não chama o Bitrix quando a lista de destinatários está vazia', async () => {
    notifyServiceGetMock.mockResolvedValue([])

    await handle()

    expect(notifyMock).not.toHaveBeenCalled()
  })

  it('notifica cada usuário configurado no chat interno do Bitrix', async () => {
    notifyServiceGetMock.mockResolvedValue([111, 222])

    await handle()

    expect(notifyMock).toHaveBeenCalledTimes(2)
    expect(notifyMock).toHaveBeenNthCalledWith(1, {
      userId: 111,
      message: expect.stringContaining('Z-1'),
      tag: 'thinkzap:disconnect',
    })
    expect(notifyMock).toHaveBeenNthCalledWith(2, {
      userId: 222,
      message: expect.stringContaining('Z-1'),
      tag: 'thinkzap:disconnect',
    })
  })

  it('inclui o motivo do evento na mensagem quando presente', async () => {
    notifyServiceGetMock.mockResolvedValue([111])

    await handle({ error: 'token expirado' })

    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('token expirado') }),
    )
  })

  it('instância não encontrada encerra sem tocar o Bitrix', async () => {
    getInstanceByInstanceIdMock.mockResolvedValue(null)

    await handle()

    expect(getDomainByIdMock).not.toHaveBeenCalled()
    expect(notifyMock).not.toHaveBeenCalled()
  })

  it('domínio não encontrado encerra sem tocar o Bitrix', async () => {
    getDomainByIdMock.mockResolvedValue(null)

    await handle()

    expect(notifyMock).not.toHaveBeenCalled()
  })

  it('app não encontrado encerra sem tocar o Bitrix', async () => {
    getByAppCodeAndDomainIdMock.mockResolvedValue(null)

    await handle()

    expect(notifyMock).not.toHaveBeenCalled()
  })

  it('falha ao notificar um usuário não impede os demais nem derruba o webhook', async () => {
    notifyServiceGetMock.mockResolvedValue([111, 222])
    notifyMock
      .mockRejectedValueOnce(new Error('Bitrix indisponível'))
      .mockResolvedValueOnce(true)

    await expect(handle()).resolves.toBeUndefined()

    expect(notifyMock).toHaveBeenCalledTimes(2)
  })

  it('erro ao resolver contexto (ex.: Bitrix fora do ar) não derruba o webhook', async () => {
    getDomainByIdMock.mockRejectedValue(new Error('DB indisponível'))

    await expect(handle()).resolves.toBeUndefined()
  })
})
