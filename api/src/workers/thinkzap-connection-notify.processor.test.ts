import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getInstanceByInstanceIdMock,
  getDomainByIdMock,
  getByAppCodeAndDomainIdMock,
  notifyServiceGetMock,
  notifyMock,
} = vi.hoisted(() => ({
  getInstanceByInstanceIdMock: vi.fn(),
  getDomainByIdMock: vi.fn(),
  getByAppCodeAndDomainIdMock: vi.fn(),
  notifyServiceGetMock: vi.fn(),
  notifyMock: vi.fn(),
}))

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock(
  '@/modules/thinkzap/infra/persistence/repositories/prisma-instance.repository',
  () => ({
    PrismaInstanceRepository: class {
      getInstanceByInstanceId = getInstanceByInstanceIdMock
    },
  }),
)

vi.mock(
  '@/shared/infra/persistence/repositories/prisma-domain.repository',
  () => ({
    PrismaDomainRepository: class {
      getDomainById = getDomainByIdMock
    },
  }),
)

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
  '@/modules/thinkzap/application/thinkzap-connection-notify-recipients.service',
  () => ({
    ThinkzapConnectionNotifyRecipientsService: class {
      get = notifyServiceGetMock
    },
  }),
)

vi.mock(
  '@/modules/thinkzap/infra/persistence/repositories/prisma-connection-notify-recipient.repository',
  () => ({ PrismaConnectionNotifyRecipientRepository: class {} }),
)

vi.mock('@/shared/application/bitrix-system-notification.service', () => ({
  BitrixSystemNotificationService: class {
    notify = notifyMock
  },
}))

import { processConnectionEventJob } from './thinkzap-connection-notify.processor'
import type { ThinkzapConnectionEventJob } from '@/queue/thinkzap-connection-events.queue'

const job = (
  overrides: Partial<ThinkzapConnectionEventJob> = {},
): ThinkzapConnectionEventJob => ({
  type: 'disconnected',
  instanceId: 'Z-1',
  momment: 1789991068459,
  error:
    'It was not possible to restore a session with the current token, please login again',
  ...overrides,
})

describe('processConnectionEventJob', () => {
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

  it('não chama o Bitrix quando a lista de destinatários está vazia', async () => {
    notifyServiceGetMock.mockResolvedValue([])

    const result = await processConnectionEventJob(job())

    expect(notifyMock).not.toHaveBeenCalled()
    expect(result).toEqual({ outcome: 'no-recipients' })
  })

  it('notifica cada usuário configurado no chat interno do Bitrix (desconexão)', async () => {
    notifyServiceGetMock.mockResolvedValue([111, 222])

    const result = await processConnectionEventJob(job())

    expect(notifyMock).toHaveBeenCalledTimes(2)
    const firstCall = notifyMock.mock.calls[0]?.[0] as {
      userId: number
      message: string
      tag: string
    }
    expect(firstCall.userId).toBe(111)
    expect(firstCall.message).toContain('Z-1')
    expect(firstCall.tag).toBe('thinkzap:connection:disconnected')
    expect(result).toEqual({ outcome: 'notified', recipients: 2, sent: 2 })
  })

  it('notifica reconexão com tag e mensagem diferentes', async () => {
    notifyServiceGetMock.mockResolvedValue([111])

    await processConnectionEventJob(
      job({ type: 'connected', error: undefined, phone: '554388092447' }),
    )

    const call = notifyMock.mock.calls[0]?.[0] as {
      userId: number
      message: string
      tag: string
    }
    expect(call.userId).toBe(111)
    expect(call.message).toContain('554388092447')
    expect(call.tag).toBe('thinkzap:connection:connected')
  })

  it('inclui o motivo do evento na mensagem de desconexão quando presente', async () => {
    notifyServiceGetMock.mockResolvedValue([111])

    await processConnectionEventJob(job({ error: 'token expirado' }))

    const call = notifyMock.mock.calls[0]?.[0] as { message: string }
    expect(call.message).toContain('token expirado')
  })

  it('instância não encontrada encerra sem tocar o Bitrix', async () => {
    getInstanceByInstanceIdMock.mockResolvedValue(null)

    const result = await processConnectionEventJob(job())

    expect(getDomainByIdMock).not.toHaveBeenCalled()
    expect(notifyMock).not.toHaveBeenCalled()
    expect(result).toEqual({ outcome: 'context-not-found' })
  })

  it('domínio não encontrado encerra sem tocar o Bitrix', async () => {
    getDomainByIdMock.mockResolvedValue(null)

    const result = await processConnectionEventJob(job())

    expect(notifyMock).not.toHaveBeenCalled()
    expect(result).toEqual({ outcome: 'context-not-found' })
  })

  it('app não encontrado encerra sem tocar o Bitrix', async () => {
    getByAppCodeAndDomainIdMock.mockResolvedValue(null)

    const result = await processConnectionEventJob(job())

    expect(notifyMock).not.toHaveBeenCalled()
    expect(result).toEqual({ outcome: 'context-not-found' })
  })

  it('falha ao notificar um usuário não impede os demais', async () => {
    notifyServiceGetMock.mockResolvedValue([111, 222])
    notifyMock
      .mockRejectedValueOnce(new Error('Bitrix indisponível'))
      .mockResolvedValueOnce(true)

    const result = await processConnectionEventJob(job())

    expect(notifyMock).toHaveBeenCalledTimes(2)
    expect(result).toEqual({ outcome: 'notified', recipients: 2, sent: 1 })
  })

  it('propaga erro ao montar o client Bitrix — a fila deve retentar', async () => {
    notifyServiceGetMock.mockResolvedValue([111])
    const { makeBitrixClientByDomainAndAppCoode } =
      await import('@/shared/main/make-bitrix-client')
    vi.mocked(makeBitrixClientByDomainAndAppCoode).mockRejectedValueOnce(
      new Error('Bitrix fora do ar'),
    )

    await expect(processConnectionEventJob(job())).rejects.toThrow(
      'Bitrix fora do ar',
    )
  })

  it('chama appendJobLog para a aba de logs do job', async () => {
    notifyServiceGetMock.mockResolvedValue([])
    const appendJobLog = vi.fn().mockResolvedValue(undefined)

    await processConnectionEventJob(job(), { appendJobLog })

    expect(appendJobLog).toHaveBeenCalled()
  })
})
