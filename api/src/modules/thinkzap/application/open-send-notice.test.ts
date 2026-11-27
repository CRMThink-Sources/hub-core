import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import {
  OPEN_SEND_NOTICE_TIMEOUT_MS,
  openSendNotice,
  type OpenSendNoticeDeps,
} from './open-send-notice'

const input = {
  entity: 'DEAL',
  entityId: '10',
  domainId: 'domain_1',
  appCode: 'crmthink.thinkzap',
  operatorBitrixUserId: '7',
}

const makeDeps = () => {
  const ensure = vi
    .fn<OpenSendNoticeDeps['notices']['ensure']>()
    .mockResolvedValue({ id: 'notice_1' } as never)
  const enqueue = vi
    .fn<OpenSendNoticeDeps['enqueue']>()
    .mockResolvedValue(undefined)
  return { ensure, enqueue, deps: { notices: { ensure }, enqueue } }
}

const hang = () => new Promise<never>(() => undefined)

afterEach(() => {
  vi.useRealTimers()
})

describe('openSendNotice', () => {
  it('cria o aviso imediato, com identidade própria a cada disparo', async () => {
    const { deps, ensure, enqueue } = makeDeps()

    const first = await openSendNotice(input, deps)
    await openSendNotice(input, deps)

    expect(first?.id).toBe('notice_1')
    expect(ensure).toHaveBeenCalledWith({
      ...input,
      eager: true,
      dispatchKey: expect.any(String) as unknown as string,
    })
    expect(ensure.mock.calls[0]?.[0].dispatchKey).not.toBe(
      ensure.mock.calls[1]?.[0].dispatchKey,
    )
    expect(enqueue).not.toHaveBeenCalled()
  })

  it('refresh agenda o comentário do aviso', async () => {
    const { deps, enqueue } = makeDeps()

    const notice = await openSendNotice(input, deps)
    await notice?.refresh()

    expect(enqueue).toHaveBeenCalledWith({
      kind: 'comment',
      noticeId: 'notice_1',
    })
  })

  it.each([{ entity: '' }, { entityId: '' }])(
    'fora do CRM não cria aviso (%o)',
    async missing => {
      const { deps, ensure } = makeDeps()

      expect(await openSendNotice({ ...input, ...missing }, deps)).toBeNull()
      expect(ensure).not.toHaveBeenCalled()
    },
  )

  it('devolve null quando o banco falha', async () => {
    const { deps, ensure } = makeDeps()
    ensure.mockRejectedValue(new Error('banco fora'))

    expect(await openSendNotice(input, deps)).toBeNull()
  })

  it('desiste da abertura que não responde, para o webhook não ficar pendurado', async () => {
    vi.useFakeTimers()
    const { deps, ensure } = makeDeps()
    ensure.mockImplementation(hang)

    const opening = openSendNotice(input, deps)
    await vi.advanceTimersByTimeAsync(OPEN_SEND_NOTICE_TIMEOUT_MS)

    await expect(opening).resolves.toBeNull()
  })

  it('refresh não lança quando a fila falha', async () => {
    const { deps, enqueue } = makeDeps()
    enqueue.mockRejectedValue(new Error('redis fora'))

    const notice = await openSendNotice(input, deps)

    await expect(notice?.refresh()).resolves.toBeUndefined()
  })

  // Com o Redis fora, o `add` do BullMQ não rejeita: fica esperando a conexão voltar.
  it('refresh desiste da fila que não responde', async () => {
    vi.useFakeTimers()
    const { deps, enqueue } = makeDeps()
    enqueue.mockImplementation(hang)
    const notice = await openSendNotice(input, deps)

    const refreshing = notice?.refresh()
    await vi.advanceTimersByTimeAsync(OPEN_SEND_NOTICE_TIMEOUT_MS)

    await expect(refreshing).resolves.toBeUndefined()
  })
})
