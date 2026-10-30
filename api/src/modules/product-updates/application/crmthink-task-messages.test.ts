import { describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import type { PortalUser } from '@/modules/portal/domain/entities/portal-user'
import {
  BitrixUserNotLinkedError,
  CrmthinkTaskNotFoundError,
  CrmthinkTasksUnavailableError,
  InvalidTaskMessageError,
  ProductUpdateActionRefusedError,
  ProductUpdateNotFoundError,
  TasksSyncDisabledError,
} from '../domain/errors/product-update.errors'
import {
  InMemoryCrmthinkTasksGateway,
  buildCrmthinkTask,
} from '../infra/adapters/in-memory-crmthink-tasks-gateway.fake'
import {
  InMemoryProductUpdateRepository,
  buildProductUpdate,
} from '../infra/persistence/in-memory-product-update.repository.fake'
import { ListCrmthinkTaskMessages } from './list-crmthink-task-messages'
import { SendCrmthinkTaskMessage } from './send-crmthink-task-message'

const portalUser = (overrides: Partial<PortalUser> = {}): PortalUser => ({
  id: 'portal-user-1',
  email: 'a@b.c',
  name: 'Ana',
  passwordHash: 'x',
  role: 'ADMIN',
  isActive: true,
  bitrixUserId: 15,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

function makeSut({
  update = buildProductUpdate({ bitrixTaskId: 42 }),
  user = portalUser() as PortalUser | null,
  syncEnabled = true,
} = {}) {
  const repository = new InMemoryProductUpdateRepository([update])
  const gateway = new InMemoryCrmthinkTasksGateway([
    buildCrmthinkTask({ id: 42 }),
  ])
  const findById = vi.fn().mockResolvedValue(user)
  return {
    gateway,
    findById,
    list: new ListCrmthinkTaskMessages(repository, gateway),
    send: new SendCrmthinkTaskMessage(repository, { findById }, gateway, {
      syncEnabled,
      groupId: 2677,
    }),
  }
}

const sendInput = { id: 'pu-1', portalUserId: 'portal-user-1', text: 'olá' }

describe('ListCrmthinkTaskMessages', () => {
  it('devolve modo e mensagens da tarefa vinculada, mesmo com a sincronização desligada', async () => {
    const { list, gateway } = makeSut({ syncEnabled: false })
    gateway.messagesMode = 'comments'
    gateway.messages.set(42, [
      {
        id: 1,
        authorId: 7,
        authorName: 'João',
        text: 'oi',
        createdAt: '2026-10-22T10:00:00Z',
        isSystem: false,
      },
    ])

    const result = await list.execute({ id: 'pu-1' })

    expect(result.mode).toBe('comments')
    expect(result.messages).toHaveLength(1)
    expect(gateway.calls).toEqual([{ method: 'listTaskMessages', args: [42] }])
  })

  it('novidade inexistente: 404', async () => {
    const { list } = makeSut()
    await expect(list.execute({ id: 'nope' })).rejects.toBeInstanceOf(
      ProductUpdateNotFoundError,
    )
  })

  it('sem tarefa: 409 no-task-linked, sem tocar no Bitrix', async () => {
    const { list, gateway } = makeSut({ update: buildProductUpdate() })
    await expect(list.execute({ id: 'pu-1' })).rejects.toMatchObject({
      reason: 'no-task-linked',
    })
    expect(gateway.count()).toBe(0)
  })

  it('tarefa ilegível: CrmthinkTaskNotFoundError; Bitrix fora: indisponível', async () => {
    const gone = makeSut({
      update: buildProductUpdate({ bitrixTaskId: 99 }),
    })
    await expect(gone.list.execute({ id: 'pu-1' })).rejects.toBeInstanceOf(
      CrmthinkTaskNotFoundError,
    )

    const down = makeSut()
    down.gateway.failing = true
    await expect(down.list.execute({ id: 'pu-1' })).rejects.toBeInstanceOf(
      CrmthinkTasksUnavailableError,
    )
  })
})

describe('SendCrmthinkTaskMessage', () => {
  it('envia o texto aparado em nome do usuário do Bitrix vinculado', async () => {
    const { send, gateway, findById } = makeSut()

    await send.execute({ ...sendInput, text: '  olá, time  ' })

    expect(findById).toHaveBeenCalledWith('portal-user-1')
    expect(gateway.sentMessages).toEqual([
      { taskId: 42, text: 'olá, time', authorBitrixUserId: 15 },
    ])
  })

  it('aceita exatamente 4000 caracteres', async () => {
    const { send, gateway } = makeSut()
    await send.execute({ ...sendInput, text: 'a'.repeat(4000) })
    expect(gateway.sentMessages).toHaveLength(1)
  })

  it('sincronização desligada vem primeiro, antes até da novidade', async () => {
    const { send, gateway, findById } = makeSut({ syncEnabled: false })
    await expect(
      send.execute({ ...sendInput, id: 'nope', text: '' }),
    ).rejects.toBeInstanceOf(TasksSyncDisabledError)
    expect(findById).not.toHaveBeenCalled()
    expect(gateway.count()).toBe(0)
  })

  it('novidade inexistente: 404, antes de olhar a tarefa e o texto', async () => {
    const { send } = makeSut()
    await expect(
      send.execute({ ...sendInput, id: 'nope', text: '' }),
    ).rejects.toBeInstanceOf(ProductUpdateNotFoundError)
  })

  it('sem tarefa: no-task-linked, antes de validar o texto', async () => {
    const { send, findById } = makeSut({ update: buildProductUpdate() })
    const error = await send
      .execute({ ...sendInput, text: '' })
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ProductUpdateActionRefusedError)
    expect(error).toMatchObject({ reason: 'no-task-linked' })
    expect(findById).not.toHaveBeenCalled()
  })

  it.each([
    ['vazio', ''],
    ['só espaços', '   \n '],
    ['maior que 4000', 'a'.repeat(4001)],
    ['não é string', 42],
    ['ausente', undefined],
  ])('texto %s: invalid-message, antes do usuário', async (_, text) => {
    const { send, findById, gateway } = makeSut({ user: null })
    await expect(send.execute({ ...sendInput, text })).rejects.toBeInstanceOf(
      InvalidTaskMessageError,
    )
    expect(findById).not.toHaveBeenCalled()
    expect(gateway.count()).toBe(0)
  })

  it('usuário sem bitrixUserId ou inexistente: bitrix-user-not-linked', async () => {
    for (const user of [portalUser({ bitrixUserId: null }), null]) {
      const { send, gateway } = makeSut({ user })
      await expect(send.execute(sendInput)).rejects.toBeInstanceOf(
        BitrixUserNotLinkedError,
      )
      expect(gateway.count()).toBe(0)
    }
  })

  it('tarefa ilegível e Bitrix fora propagam', async () => {
    const gone = makeSut({ update: buildProductUpdate({ bitrixTaskId: 99 }) })
    await expect(gone.send.execute(sendInput)).rejects.toBeInstanceOf(
      CrmthinkTaskNotFoundError,
    )

    const down = makeSut()
    down.gateway.failing = true
    await expect(down.send.execute(sendInput)).rejects.toBeInstanceOf(
      CrmthinkTasksUnavailableError,
    )
  })
})
