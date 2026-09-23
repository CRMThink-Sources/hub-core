import { beforeEach, describe, expect, it, vi } from 'vitest'

const { redisGetMock, redisSetMock } = vi.hoisted(() => ({
  redisGetMock: vi.fn(),
  redisSetMock: vi.fn(),
}))

vi.mock('@/queue/redis-connection', () => ({
  redisConnection: { get: redisGetMock, set: redisSetMock },
}))

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import {
  ThinkzapConnectionNotifyRecipientsService,
  parseCachedUserIds,
} from './thinkzap-connection-notify-recipients.service'

describe('parseCachedUserIds', () => {
  it('retorna null para cache ausente', () => {
    expect(parseCachedUserIds(null)).toBeNull()
  })

  it('retorna null para JSON inválido', () => {
    expect(parseCachedUserIds('{not json')).toBeNull()
  })

  it('filtra valores não inteiros', () => {
    expect(parseCachedUserIds('[1, "2", 3.5, 4]')).toEqual([1, 4])
  })
})

describe('ThinkzapConnectionNotifyRecipientsService', () => {
  const repo = { listByAppId: vi.fn(), replaceAll: vi.fn() }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lê do cache quando presente, sem tocar o repositório', async () => {
    redisGetMock.mockResolvedValue('[111,222]')
    const service = new ThinkzapConnectionNotifyRecipientsService(
      repo as never,
      'app-1',
    )

    const result = await service.get()

    expect(result).toEqual([111, 222])
    expect(repo.listByAppId).not.toHaveBeenCalled()
  })

  it('lê o repositório e grava no cache quando cache está vazio', async () => {
    redisGetMock.mockResolvedValue(null)
    repo.listByAppId.mockResolvedValue([333])
    const service = new ThinkzapConnectionNotifyRecipientsService(
      repo as never,
      'app-1',
    )

    const result = await service.get()

    expect(result).toEqual([333])
    expect(redisSetMock).toHaveBeenCalledWith(
      'thinkzap:connection-notify:app-1',
      '[333]',
      'EX',
      300,
    )
  })

  it('erro de leitura do Redis não impede a leitura do repositório (fail-open)', async () => {
    redisGetMock.mockRejectedValue(new Error('Redis indisponível'))
    repo.listByAppId.mockResolvedValue([444])
    const service = new ThinkzapConnectionNotifyRecipientsService(
      repo as never,
      'app-1',
    )

    const result = await service.get()

    expect(result).toEqual([444])
  })

  it('set substitui a lista no repositório e atualiza o cache', async () => {
    repo.replaceAll.mockResolvedValue([555, 666])
    const service = new ThinkzapConnectionNotifyRecipientsService(
      repo as never,
      'app-1',
    )

    const result = await service.set([555, 666, 666])

    expect(repo.replaceAll).toHaveBeenCalledWith('app-1', [555, 666, 666])
    expect(result).toEqual([555, 666])
    expect(redisSetMock).toHaveBeenCalledWith(
      'thinkzap:connection-notify:app-1',
      '[555,666]',
      'EX',
      300,
    )
  })

  it('erro ao gravar cache não impede o set de retornar', async () => {
    repo.replaceAll.mockResolvedValue([777])
    redisSetMock.mockRejectedValue(new Error('Redis indisponível'))
    const service = new ThinkzapConnectionNotifyRecipientsService(
      repo as never,
      'app-1',
    )

    await expect(service.set([777])).resolves.toEqual([777])
  })
})
