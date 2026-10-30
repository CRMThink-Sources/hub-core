import { describe, expect, it, vi } from 'vitest'
import { BitrixError } from '@/shared/infra/clients/errors/bitrix-client.error'
import {
  CrmthinkTaskNotFoundError,
  CrmthinkTasksUnavailableError,
} from '../../domain/errors/product-update.errors'
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

const notFound = () =>
  new BitrixError(
    'Bitrix error: 400 - {"error":"ERROR_CORE","error_description":"TASKS_ERROR_EXCEPTION_#256; 256/TE/TASK_NOT_FOUND_OR_NOT_ACCESSIBLE<br>"}',
  )

describe('BitrixCrmthinkTasksGateway — conversa da tarefa', () => {
  describe('listTaskMessages', () => {
    it('cartão novo: lê o chat, ordena por id e resolve autores pelo users', async () => {
      const { gateway, callMethod } = makeSut(
        { result: { task: { id: '42', chatId: '900' } } },
        {
          result: {
            messages: [
              {
                id: 12,
                chat_id: 900,
                author_id: 15,
                date: '2026-10-22T12:00:00+00:00',
                text: '  segunda [B]negrito[/B]  ',
              },
              {
                id: 10,
                author_id: '7',
                date: '2026-10-22T10:00:00+00:00',
                text: 'primeira',
              },
            ],
            users: [
              { id: 15, name: ' Maria Souza ' },
              { id: 7, name: 'João Lima' },
            ],
          },
        },
      )

      const result = await gateway.listTaskMessages(42)

      expect(callMethod).toHaveBeenNthCalledWith(1, 'tasks.task.get', {
        taskId: 42,
        select: ['ID', 'CHAT_ID'],
      })
      expect(callMethod).toHaveBeenNthCalledWith(2, 'im.dialog.messages.get', {
        DIALOG_ID: 'chat900',
        LIMIT: 50,
      })
      expect(result).toEqual({
        mode: 'chat',
        messages: [
          {
            id: 10,
            authorId: 7,
            authorName: 'João Lima',
            text: 'primeira',
            createdAt: '2026-10-22T10:00:00+00:00',
            isSystem: false,
          },
          {
            id: 12,
            authorId: 15,
            authorName: 'Maria Souza',
            text: 'segunda [B]negrito[/B]',
            createdAt: '2026-10-22T12:00:00+00:00',
            isSystem: false,
          },
        ],
      })
    })

    it('mensagem com author_id 0 ou ausente é do sistema', async () => {
      const { gateway } = makeSut(
        { result: { task: { chatId: 900 } } },
        {
          result: {
            messages: [
              { id: 1, author_id: 0, date: 'd', text: 'Tarefa criada' },
              { id: 2, date: 'd', text: 'Status alterado' },
            ],
            users: [],
          },
        },
      )

      const { messages } = await gateway.listTaskMessages(42)

      expect(messages).toEqual([
        expect.objectContaining({
          id: 1,
          authorId: null,
          authorName: null,
          isSystem: true,
        }),
        expect.objectContaining({ id: 2, authorId: null, isSystem: true }),
      ])
    })

    it('cartão antigo: task.commentitem.getlist invertido para ascendente', async () => {
      const { gateway, callMethod } = makeSut(
        { result: { task: { id: '42', chatId: '0' } } },
        {
          result: [
            {
              ID: '31',
              AUTHOR_ID: '15',
              AUTHOR_NAME: 'Maria Souza',
              POST_DATE: '2026-10-22T12:00:00+00:00',
              POST_MESSAGE: 'nova ',
            },
            {
              ID: '30',
              AUTHOR_ID: '7',
              AUTHOR_NAME: 'João Lima',
              POST_DATE: '2026-10-22T10:00:00+00:00',
              POST_MESSAGE: 'antiga',
            },
          ],
        },
      )

      const result = await gateway.listTaskMessages(42)

      expect(callMethod).toHaveBeenNthCalledWith(
        2,
        'task.commentitem.getlist',
        {
          TASKID: 42,
          ORDER: { ID: 'desc' },
        },
      )
      expect(result.mode).toBe('comments')
      expect(result.messages.map(m => m.id)).toEqual([30, 31])
      expect(result.messages[1]).toEqual({
        id: 31,
        authorId: 15,
        authorName: 'Maria Souza',
        text: 'nova',
        createdAt: '2026-10-22T12:00:00+00:00',
        isSystem: false,
      })
    })

    it('chatId ausente: também cai nos comentários', async () => {
      const { gateway, callMethod } = makeSut(
        { result: { task: { id: '42' } } },
        { result: [] },
      )

      expect(await gateway.listTaskMessages(42)).toEqual({
        mode: 'comments',
        messages: [],
      })
      expect(callMethod).toHaveBeenCalledTimes(2)
    })

    it('tarefa ilegível (erro do Bitrix ou task vazia): CrmthinkTaskNotFoundError', async () => {
      await expect(
        makeSut(notFound()).gateway.listTaskMessages(42),
      ).rejects.toBeInstanceOf(CrmthinkTaskNotFoundError)
      await expect(
        makeSut({ result: { task: false } }).gateway.listTaskMessages(42),
      ).rejects.toBeInstanceOf(CrmthinkTaskNotFoundError)
    })

    it('erro do Bitrix (HTTP ou no corpo 200): CrmthinkTasksUnavailableError', async () => {
      await expect(
        makeSut(
          new BitrixError('Bitrix error: 401 - insufficient_scope'),
        ).gateway.listTaskMessages(42),
      ).rejects.toBeInstanceOf(CrmthinkTasksUnavailableError)

      await expect(
        makeSut(
          { result: { task: { chatId: 900 } } },
          { error: 'ERROR_CORE', error_description: 'sem escopo im' },
        ).gateway.listTaskMessages(42),
      ).rejects.toThrow('im.dialog.messages.get: sem escopo im')
    })
  })

  describe('sendTaskMessage', () => {
    it('chama task.commentitem.add com TASKID e FIELDS exatos', async () => {
      const { gateway, callMethod } = makeSut({ result: 77 })

      await gateway.sendTaskMessage(42, 'olá', 15)

      expect(callMethod).toHaveBeenCalledTimes(1)
      expect(callMethod).toHaveBeenCalledWith('task.commentitem.add', {
        TASKID: 42,
        FIELDS: { POST_MESSAGE: 'olá', AUTHOR_ID: 15 },
      })
    })

    it('ERROR_CORE: CrmthinkTasksUnavailableError com a descrição', async () => {
      const { gateway } = makeSut(
        new BitrixError(
          'Bitrix error: 400 - {"error":"ERROR_CORE","error_description":"Usuário sem permissão"}',
        ),
      )

      await expect(gateway.sendTaskMessage(42, 'x', 15)).rejects.toThrow(
        CrmthinkTasksUnavailableError,
      )
    })

    it('error no corpo 200: CrmthinkTasksUnavailableError', async () => {
      const { gateway } = makeSut({
        error: 'ERROR_CORE',
        error_description: 'falhou',
      })

      await expect(gateway.sendTaskMessage(42, 'x', 15)).rejects.toThrow(
        'task.commentitem.add: falhou',
      )
    })

    it('tarefa ilegível: CrmthinkTaskNotFoundError', async () => {
      const { gateway } = makeSut(notFound())

      await expect(gateway.sendTaskMessage(42, 'x', 15)).rejects.toBeInstanceOf(
        CrmthinkTaskNotFoundError,
      )
    })
  })
})
