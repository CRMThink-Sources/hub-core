import { describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import type { Request } from 'express'
import { ListCrmthinkTaskMessages } from '../../application/list-crmthink-task-messages'
import { SendCrmthinkTaskMessage } from '../../application/send-crmthink-task-message'
import {
  InMemoryCrmthinkTasksGateway,
  buildCrmthinkTask,
} from '../../infra/adapters/in-memory-crmthink-tasks-gateway.fake'
import {
  InMemoryProductUpdateRepository,
  buildProductUpdate,
} from '../../infra/persistence/in-memory-product-update.repository.fake'
import {
  ListCrmthinkTaskMessagesController,
  SendCrmthinkTaskMessageController,
} from './product-updates-portal-controllers'

const request = (overrides: Partial<Request> = {}): Request =>
  ({
    params: { id: 'pu-1' },
    query: {},
    body: {},
    portalUserId: 'portal-user-1',
    ...overrides,
  }) as unknown as Request

function makeSut(update = buildProductUpdate({ bitrixTaskId: 42 })) {
  const repository = new InMemoryProductUpdateRepository([update])
  const gateway = new InMemoryCrmthinkTasksGateway([
    buildCrmthinkTask({ id: 42 }),
  ])
  const findById = vi.fn().mockResolvedValue({ bitrixUserId: 15 })
  return {
    gateway,
    list: new ListCrmthinkTaskMessagesController(
      new ListCrmthinkTaskMessages(repository, gateway),
    ),
    send: new SendCrmthinkTaskMessageController(
      new SendCrmthinkTaskMessage(repository, { findById }, gateway, {
        syncEnabled: true,
        groupId: 2677,
      }),
    ),
  }
}

describe('controllers da conversa da tarefa', () => {
  it('sem sessão: 401 sem chamar o caso de uso', async () => {
    const execute = vi.fn()
    const noSession = request({ portalUserId: undefined })

    expect(
      (
        await new ListCrmthinkTaskMessagesController({ execute }).perform(
          noSession,
        )
      ).status,
    ).toBe(401)
    expect(
      (
        await new SendCrmthinkTaskMessageController({ execute }).perform(
          noSession,
        )
      ).status,
    ).toBe(401)
    expect(execute).not.toHaveBeenCalled()
  })

  it('GET: 200 com { mode, messages }', async () => {
    const { list } = makeSut()

    const response = await list.perform(request())

    expect(response.status).toBe(200)
    expect(response.result).toEqual({ mode: 'chat', messages: [] })
  })

  it('GET sem tarefa: 409 no-task-linked; novidade inexistente: 404', async () => {
    const noTask = await makeSut(buildProductUpdate()).list.perform(request())
    expect(noTask.status).toBe(409)
    expect(noTask.result).toMatchObject({ reason: 'no-task-linked' })

    const missing = await makeSut().list.perform(
      request({ params: { id: 'x' } } as Partial<Request>),
    )
    expect(missing.status).toBe(404)
  })

  it('GET com tarefa que sumiu: 422 task-not-found', async () => {
    const response = await makeSut(
      buildProductUpdate({ bitrixTaskId: 99 }),
    ).list.perform(request())

    expect(response.status).toBe(422)
    expect(response.result).toMatchObject({
      reason: 'task-not-found',
      taskId: 99,
    })
  })

  it('POST: 200 { sent: true } e repassa o autor do Bitrix', async () => {
    const { send, gateway } = makeSut()

    const response = await send.perform(request({ body: { text: ' oi ' } }))

    expect(response.status).toBe(200)
    expect(response.result).toEqual({ sent: true })
    expect(gateway.sentMessages).toEqual([
      { taskId: 42, text: 'oi', authorBitrixUserId: 15 },
    ])
  })

  it('POST com texto ausente ou que não é string: 422 invalid-message', async () => {
    const { send } = makeSut()

    for (const body of [{}, { text: 5 }, { text: '  ' }]) {
      const response = await send.perform(request({ body }))
      expect(response.status).toBe(422)
      expect(response.result).toMatchObject({ reason: 'invalid-message' })
    }
  })

  it('POST com Bitrix fora: 502', async () => {
    const { send, gateway } = makeSut()
    gateway.failing = true

    const response = await send.perform(request({ body: { text: 'oi' } }))

    expect(response.status).toBe(502)
    expect(response.result).toMatchObject({
      reason: 'crmthink-tasks-unavailable',
    })
  })
})
