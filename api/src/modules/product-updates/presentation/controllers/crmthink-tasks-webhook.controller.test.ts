import { Request } from 'express'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { SyncCrmthinkTask } from '../../application/sync-crmthink-task'
import {
  InMemoryCrmthinkTasksGateway,
  buildCrmthinkTask,
} from '../../infra/adapters/in-memory-crmthink-tasks-gateway.fake'
import {
  InMemoryProductUpdateRepository,
  buildProductUpdate,
} from '../../infra/persistence/in-memory-product-update.repository.fake'
import { CrmthinkTasksWebhookController } from './crmthink-tasks-webhook.controller'

const TOKEN = 'application_token_das_tarefas'

/** Corpo como o `express.urlencoded({ extended: true })` entrega. */
const formBody = (overrides: {
  event?: string
  after?: string
  before?: string
  token?: string
}) => ({
  event: overrides.event ?? 'ONTASKUPDATE',
  data: {
    ...(overrides.after !== undefined && {
      FIELDS_AFTER: { ID: overrides.after },
    }),
    ...(overrides.before !== undefined && {
      FIELDS_BEFORE: { ID: overrides.before },
    }),
  },
  ts: '1761134400',
  auth: {
    application_token: overrides.token ?? TOKEN,
    domain: 'crmthink.bitrix24.com.br',
  },
})

const reqWith = (body: unknown) => ({ body }) as unknown as Request

function makeSut(
  options: {
    token?: string
    syncEnabled?: boolean
    updates?: ReturnType<typeof buildProductUpdate>[]
  } = {},
) {
  const repository = new InMemoryProductUpdateRepository(
    options.updates ?? [
      buildProductUpdate({
        id: 'pu-1',
        progress: 'DONE',
        visibility: 'PUBLISHED',
        bitrixTaskId: 42,
        bitrixTaskStatus: 5,
      }),
    ],
  )
  const gateway = new InMemoryCrmthinkTasksGateway([
    buildCrmthinkTask({ id: 42, status: 5 }),
  ])
  const findByBitrixTaskId = vi.spyOn(repository, 'findByBitrixTaskId')
  const enqueue = vi.fn(() => Promise.resolve({ id: 'task-42' }))
  const controller = new CrmthinkTasksWebhookController(
    new SyncCrmthinkTask(repository, gateway),
    enqueue,
    options.token ?? TOKEN,
    options.syncEnabled ?? true,
  )
  return { repository, gateway, enqueue, findByBitrixTaskId, controller }
}

describe('CrmthinkTasksWebhookController', () => {
  it('sem token configurado responde 503', async () => {
    const { controller, gateway, enqueue } = makeSut({ token: '' })

    const response = await controller.perform(
      reqWith(formBody({ after: '42' })),
    )

    expect(response.status).toBe(503)
    expect(gateway.count()).toBe(0)
    expect(enqueue).not.toHaveBeenCalled()
  })

  it('token inválido responde 401 e nada é processado', async () => {
    const { controller, gateway, enqueue, findByBitrixTaskId } = makeSut()

    const response = await controller.perform(
      reqWith(formBody({ after: '42', token: 'outro' })),
    )

    expect(response.status).toBe(401)
    expect(findByBitrixTaskId).not.toHaveBeenCalled()
    expect(gateway.count()).toBe(0)
    expect(enqueue).not.toHaveBeenCalled()
  })

  it('payload malformado responde 200 sem processar', async () => {
    const { controller, gateway, enqueue, findByBitrixTaskId } = makeSut()

    for (const body of [
      formBody({}),
      formBody({ after: 'abc' }),
      formBody({ after: '0' }),
      formBody({ event: 'ONTASKADD', after: '42' }),
      { ...formBody({ after: '42' }), event: undefined },
    ]) {
      const response = await controller.perform(reqWith(body))
      expect(response).toMatchObject({
        status: 200,
        result: { handled: false, reason: 'malformed' },
      })
    }

    expect(findByBitrixTaskId).not.toHaveBeenCalled()
    expect(gateway.count()).toBe(0)
    expect(enqueue).not.toHaveBeenCalled()
  })

  it('sincronização desligada responde 200 sem processar', async () => {
    const { controller, gateway, enqueue, findByBitrixTaskId } = makeSut({
      syncEnabled: false,
    })

    const response = await controller.perform(
      reqWith(formBody({ after: '42' })),
    )

    expect(response).toMatchObject({
      status: 200,
      result: { handled: false, reason: 'sync-disabled' },
    })
    expect(findByBitrixTaskId).not.toHaveBeenCalled()
    expect(gateway.count()).toBe(0)
    expect(enqueue).not.toHaveBeenCalled()
  })

  it('tarefa não vinculada: 200, só a consulta ao banco e nenhuma chamada ao Bitrix', async () => {
    const { controller, gateway, enqueue, findByBitrixTaskId } = makeSut()

    const response = await controller.perform(
      reqWith(formBody({ after: '777' })),
    )

    expect(response).toMatchObject({
      status: 200,
      result: { handled: false, reason: 'not-linked' },
    })
    expect(findByBitrixTaskId).toHaveBeenCalledExactlyOnceWith(777)
    expect(gateway.count()).toBe(0)
    expect(enqueue).not.toHaveBeenCalled()
  })

  it('ONTASKDELETE de tarefa vinculada desvincula direto e mantém a situação', async () => {
    const { controller, repository, gateway, enqueue } = makeSut()

    const response = await controller.perform(
      reqWith(formBody({ event: 'ONTASKDELETE', before: '42' })),
    )

    expect(response).toMatchObject({
      status: 200,
      result: { handled: true, outcome: 'unlinked' },
    })
    expect(repository.rows.get('pu-1')).toMatchObject({
      progress: 'DONE',
      visibility: 'PUBLISHED',
      bitrixTaskId: null,
      bitrixTaskStatus: null,
    })
    expect(gateway.count()).toBe(0)
    expect(enqueue).not.toHaveBeenCalled()
  })

  it('ONTASKDELETE de tarefa não vinculada: 200 sem efeito', async () => {
    const { controller, repository, gateway } = makeSut()

    const response = await controller.perform(
      reqWith(formBody({ event: 'ONTASKDELETE', before: '777' })),
    )

    expect(response.status).toBe(200)
    expect(repository.rows.get('pu-1')?.bitrixTaskId).toBe(42)
    expect(gateway.count()).toBe(0)
  })

  it('ONTASKUPDATE de tarefa vinculada enfileira a releitura, sem ler o Bitrix no request', async () => {
    const { controller, gateway, enqueue } = makeSut()

    const response = await controller.perform(
      reqWith(formBody({ event: 'ontaskupdate', after: '42' })),
    )

    expect(response).toMatchObject({
      status: 200,
      result: { handled: true, outcome: 'enqueued' },
    })
    expect(enqueue).toHaveBeenCalledExactlyOnceWith({
      taskId: 42,
      traceKey: 'crmthink-task-42',
    })
    expect(gateway.count()).toBe(0)
  })

  it('falha ao enfileirar responde 200 (a reconciliação cobre)', async () => {
    const { controller, enqueue } = makeSut()
    enqueue.mockRejectedValueOnce(new Error('redis fora'))

    const response = await controller.perform(
      reqWith(formBody({ after: '42' })),
    )

    expect(response).toMatchObject({
      status: 200,
      result: { handled: false, reason: 'error' },
    })
  })
})
