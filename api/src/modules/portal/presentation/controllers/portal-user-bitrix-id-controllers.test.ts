import type { Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'
import { PortalUserNotFoundError } from '../../domain/errors/portal-auth.errors'
import type { CreatePortalUser } from '../../application/create-portal-user'
import type { UpdatePortalUserBitrixId } from '../../application/update-portal-user-bitrix-id'
import { CreatePortalUserController } from './create-portal-user-controller'
import { UpdatePortalUserBitrixIdController } from './update-portal-user-bitrix-id-controller'

const res = {} as Response

function request(parts: { params?: object; body?: object }): Request {
  return { params: {}, body: {}, ...parts } as Request
}

describe('CreatePortalUserController com ID do Bitrix', () => {
  const body = {
    email: 'maria@crmthink.com.br',
    name: 'Maria',
    password: 'senha-forte-123',
  }

  function makeSut() {
    const execute = vi.fn().mockResolvedValue({ id: 'user-1' })
    const controller = new CreatePortalUserController({
      execute,
    } as unknown as CreatePortalUser)
    return { execute, controller }
  }

  it('repassa o ID válido ao caso de uso', async () => {
    const { execute, controller } = makeSut()

    const response = await controller.perform(
      request({ body: { ...body, bitrixUserId: 42 } }),
      res,
    )

    expect(response.status).toBe(201)
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ bitrixUserId: 42 }),
    )
  })

  it('aceita o cadastro sem ID', async () => {
    const { controller } = makeSut()

    const response = await controller.perform(request({ body }), res)

    expect(response.status).toBe(201)
  })

  it.each([['abc'], [0], [-3], [1.5], [2_147_483_648]])(
    'ID %j inválido: 400 e nenhum usuário criado',
    async bitrixUserId => {
      const { execute, controller } = makeSut()

      const response = await controller.perform(
        request({ body: { ...body, bitrixUserId } }),
        res,
      )

      expect(response.status).toBe(400)
      expect(execute).not.toHaveBeenCalled()
    },
  )
})

describe('UpdatePortalUserBitrixIdController', () => {
  function makeSut(execute = vi.fn().mockResolvedValue({ id: 'user-1' })) {
    const controller = new UpdatePortalUserBitrixIdController({
      execute,
    } as unknown as UpdatePortalUserBitrixId)
    return { execute, controller }
  }

  it('define o ID', async () => {
    const { execute, controller } = makeSut()

    const response = await controller.perform(
      request({ params: { id: 'user-1' }, body: { bitrixUserId: 42 } }),
      res,
    )

    expect(response.status).toBe(200)
    expect(execute).toHaveBeenCalledWith({ id: 'user-1', bitrixUserId: 42 })
  })

  it('null remove o vínculo', async () => {
    const { execute, controller } = makeSut()

    await controller.perform(
      request({ params: { id: 'user-1' }, body: { bitrixUserId: null } }),
      res,
    )

    expect(execute).toHaveBeenCalledWith({ id: 'user-1', bitrixUserId: null })
  })

  it.each([['abc'], [0], [-1], [undefined], [2_147_483_648]])(
    'ID %j inválido: 400',
    async bitrixUserId => {
      const { execute, controller } = makeSut()

      const response = await controller.perform(
        request({ params: { id: 'user-1' }, body: { bitrixUserId } }),
        res,
      )

      expect(response.status).toBe(400)
      expect(execute).not.toHaveBeenCalled()
    },
  )

  it('usuário inexistente: 404', async () => {
    const { controller } = makeSut(
      vi.fn().mockRejectedValue(new PortalUserNotFoundError()),
    )

    const response = await controller.perform(
      request({ params: { id: 'x' }, body: { bitrixUserId: 42 } }),
      res,
    )

    expect(response.status).toBe(404)
  })
})
