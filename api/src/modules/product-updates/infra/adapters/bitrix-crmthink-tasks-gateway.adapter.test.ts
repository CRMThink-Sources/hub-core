import { describe, expect, it, vi } from 'vitest'
import { BitrixError } from '@/shared/infra/clients/errors/bitrix-client.error'
import { CrmthinkTasksUnavailableError } from '../../domain/errors/product-update.errors'
import { BitrixCrmthinkTasksGateway } from './bitrix-crmthink-tasks-gateway.adapter'

/** `BitrixClient` falso: devolve o envelope `{ result }`, como o real. */
function makeSut(...responses: unknown[]) {
  const callMethod = vi.fn()
  for (const response of responses) {
    if (response instanceof Error) callMethod.mockRejectedValueOnce(response)
    else callMethod.mockResolvedValueOnce(response)
  }
  return { callMethod, gateway: new BitrixCrmthinkTasksGateway({ callMethod }) }
}

const rawTask = (id: number | string, extra: Record<string, unknown> = {}) => ({
  id: String(id),
  title: `Tarefa ${id}`,
  status: '3',
  groupId: '2677',
  responsibleId: '15',
  responsible: { id: '15', name: 'Maria Souza' },
  ...extra,
})

const SELECT = ['ID', 'TITLE', 'STATUS', 'GROUP_ID', 'RESPONSIBLE_ID']

describe('BitrixCrmthinkTasksGateway', () => {
  describe('getTask', () => {
    it('chama tasks.task.get e converte strings numéricas', async () => {
      const { gateway, callMethod } = makeSut({
        result: { task: rawTask(42, { status: '5' }) },
      })

      const task = await gateway.getTask(42)

      expect(callMethod).toHaveBeenCalledWith('tasks.task.get', {
        taskId: 42,
        select: SELECT,
      })
      expect(task).toEqual({
        id: 42,
        title: 'Tarefa 42',
        status: 5,
        groupId: 2677,
        responsibleId: 15,
        responsibleName: 'Maria Souza',
      })
    })

    it('tarefa sem projeto: groupId "0" vira null', async () => {
      const { gateway } = makeSut({
        result: { task: rawTask(7, { groupId: '0' }) },
      })

      expect((await gateway.getTask(7))?.groupId).toBeNull()
    })

    it('tarefa inexistente ou inacessível: null, não erro', async () => {
      const { gateway } = makeSut(
        new BitrixError(
          'Bitrix error: 400 - {"error":"ERROR_CORE","error_description":"TASKS_ERROR_EXCEPTION_#256; Tarefa não encontrada; 256/TE/TASK_NOT_FOUND_OR_NOT_ACCESSIBLE<br>"}',
        ),
      )

      expect(await gateway.getTask(999)).toBeNull()
    })

    it('resposta com task vazia: null', async () => {
      const { gateway } = makeSut({ result: { task: false } })

      expect(await gateway.getTask(999)).toBeNull()
    })

    it('outra falha do Bitrix: CrmthinkTasksUnavailableError', async () => {
      const { gateway } = makeSut(
        new BitrixError(
          'Bitrix error: 401 - {"error":"insufficient_scope","error_description":"The request requires higher privileges"}',
        ),
      )

      await expect(gateway.getTask(1)).rejects.toBeInstanceOf(
        CrmthinkTasksUnavailableError,
      )
    })

    it('erro no corpo de uma resposta 200: indisponível', async () => {
      const { gateway } = makeSut({
        error: 'QUERY_LIMIT_EXCEEDED',
        error_description: 'Too many requests',
      })

      await expect(gateway.getTask(1)).rejects.toMatchObject({
        detail: 'tasks.task.get: Too many requests',
      })
    })
  })

  describe('searchTasks', () => {
    it('filtra por GROUP_ID e %TITLE, mais recentes primeiro, até 20', async () => {
      const tasks = Array.from({ length: 25 }, (_, i) => rawTask(100 - i))
      const { gateway, callMethod } = makeSut({ result: { tasks } })

      const found = await gateway.searchTasks('template', 2677)

      expect(callMethod).toHaveBeenCalledWith('tasks.task.list', {
        filter: { GROUP_ID: 2677, '%TITLE': 'template' },
        select: SELECT,
        order: { ID: 'desc' },
        start: 0,
      })
      expect(found).toHaveLength(20)
      expect(found[0]).toMatchObject({ id: 100, status: 3, groupId: 2677 })
    })

    it('falha de rede: indisponível', async () => {
      const { gateway } = makeSut(new Error('socket hang up'))

      await expect(gateway.searchTasks('x', 2677)).rejects.toBeInstanceOf(
        CrmthinkTasksUnavailableError,
      )
    })
  })

  describe('getTasks', () => {
    it('busca por ID em lotes de 50', async () => {
      const ids = Array.from({ length: 120 }, (_, i) => i + 1)
      const { gateway, callMethod } = makeSut(
        { result: { tasks: [rawTask(1)] } },
        { result: { tasks: [rawTask(51)] } },
        { result: { tasks: [rawTask(101)] } },
      )

      const found = await gateway.getTasks(ids)

      expect(callMethod).toHaveBeenCalledTimes(3)
      const filters = callMethod.mock.calls.map(
        call => (call[1] as { filter: { ID: number[] } }).filter.ID,
      )
      expect(filters.map(batch => batch.length)).toEqual([50, 50, 20])
      expect(filters[1]?.[0]).toBe(51)
      expect(found.map(task => task.id)).toEqual([1, 51, 101])
    })

    it('lista vazia: nenhuma chamada', async () => {
      const { gateway, callMethod } = makeSut()

      expect(await gateway.getTasks([])).toEqual([])
      expect(callMethod).not.toHaveBeenCalled()
    })
  })

  describe('createTask', () => {
    it('cria com TITLE, DESCRIPTION, GROUP_ID e RESPONSIBLE_ID', async () => {
      const { gateway, callMethod } = makeSut({
        result: { task: rawTask(77, { status: '2', responsibleId: '15' }) },
      })

      const task = await gateway.createTask({
        title: 'Envio de template',
        description: 'Agora com imagem.',
        groupId: 2677,
        responsibleId: 15,
      })

      expect(callMethod).toHaveBeenCalledWith('tasks.task.add', {
        fields: {
          TITLE: 'Envio de template',
          DESCRIPTION: 'Agora com imagem.',
          GROUP_ID: 2677,
          RESPONSIBLE_ID: 15,
        },
      })
      expect(task).toMatchObject({ id: 77, status: 2, responsibleId: 15 })
    })

    it('resposta sem id: indisponível', async () => {
      const { gateway } = makeSut({ result: {} })

      await expect(
        gateway.createTask({
          title: 't',
          description: 'd',
          groupId: 1,
          responsibleId: 1,
        }),
      ).rejects.toBeInstanceOf(CrmthinkTasksUnavailableError)
    })
  })

  it('completeTask e renewTask passam taskId', async () => {
    const { gateway, callMethod } = makeSut(
      { result: { task: {} } },
      { result: { task: {} } },
    )

    await gateway.completeTask(42)
    await gateway.renewTask(42)

    expect(callMethod).toHaveBeenNthCalledWith(1, 'tasks.task.complete', {
      taskId: 42,
    })
    expect(callMethod).toHaveBeenNthCalledWith(2, 'tasks.task.renew', {
      taskId: 42,
    })
  })

  it('completeTask com erro do Bitrix: indisponível', async () => {
    const { gateway } = makeSut(new BitrixError('Bitrix error: 400 - {}'))

    await expect(gateway.completeTask(42)).rejects.toBeInstanceOf(
      CrmthinkTasksUnavailableError,
    )
  })

  describe('searchUsers', () => {
    it('busca por FIND e devolve só os ativos, com nome e e-mail', async () => {
      const { gateway, callMethod } = makeSut({
        result: [
          {
            ID: '15',
            NAME: 'Maria',
            LAST_NAME: 'Souza',
            EMAIL: 'maria@crmthink.com.br',
            ACTIVE: true,
          },
          { ID: '16', NAME: 'Antigo', LAST_NAME: '', ACTIVE: false },
          { ID: '17', NAME: '', LAST_NAME: '', EMAIL: 'sem.nome@x.com' },
        ],
      })

      const users = await gateway.searchUsers('maria')

      expect(callMethod).toHaveBeenCalledWith('user.search', {
        FILTER: { FIND: 'maria' },
      })
      expect(users).toEqual([
        { id: 15, name: 'Maria Souza', email: 'maria@crmthink.com.br' },
        { id: 17, name: 'sem.nome@x.com', email: 'sem.nome@x.com' },
      ])
    })
  })
})
