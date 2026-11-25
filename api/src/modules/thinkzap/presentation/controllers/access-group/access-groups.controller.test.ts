import type { Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'
import type { AccessGroup } from '@/modules/thinkzap/domain/entities/access-group'
import { AccessGroupNameTakenError } from '@/modules/thinkzap/domain/errors/access-group-name-taken.error'
import { AccessGroupNotFoundError } from '@/modules/thinkzap/domain/errors/access-group-not-found.error'
import type { AccessGroupRepository } from '@/modules/thinkzap/domain/repositories/access-group/access-group.repository'
import {
  CreateAccessGroupController,
  ListAccessGroupsController,
  RemoveAccessGroupController,
  UpdateAccessGroupController,
} from './access-groups.controller'

const res = {} as Response
const group: AccessGroup = {
  id: 'g1',
  appId: 'app-1',
  name: 'Vendas',
  memberIds: ['7'],
  lineIds: ['100'],
  departments: [],
  createdAt: new Date(0),
  updatedAt: new Date(0),
}

const req = (extra: Record<string, unknown> = {}) =>
  ({
    thinkzapInstalledAppId: 'app-1',
    params: {},
    body: {},
    ...extra,
  }) as unknown as Request

describe('ListAccessGroupsController', () => {
  it('lista os grupos da instalação', async () => {
    const list = vi.fn<AccessGroupRepository['list']>(() =>
      Promise.resolve([group]),
    )

    const out = await new ListAccessGroupsController({ list }).perform(
      req(),
      res,
    )

    expect(list).toHaveBeenCalledWith('app-1')
    expect(out).toEqual({ status: 200, result: { groups: [group] } })
  })

  it('sem contexto de instalação responde 400', async () => {
    const list = vi.fn<AccessGroupRepository['list']>()
    const out = await new ListAccessGroupsController({ list }).perform(
      req({ thinkzapInstalledAppId: undefined }),
      res,
    )
    expect(out.status).toBe(400)
    expect(list).not.toHaveBeenCalled()
  })
})

describe('CreateAccessGroupController', () => {
  it('cria com nome aparado', async () => {
    const create = vi.fn<AccessGroupRepository['create']>(() =>
      Promise.resolve(group),
    )

    const out = await new CreateAccessGroupController({ create }).perform(
      req({ body: { name: '  Vendas ', memberIds: ['7'], lineIds: ['100'] } }),
      res,
    )

    expect(create).toHaveBeenCalledWith('app-1', {
      name: 'Vendas',
      memberIds: ['7'],
      lineIds: ['100'],
    })
    expect(out.status).toBe(200)
  })

  it('repassa os departamentos informados, sem subdepartamentos por padrão', async () => {
    const create = vi.fn<AccessGroupRepository['create']>(() =>
      Promise.resolve(group),
    )

    await new CreateAccessGroupController({ create }).perform(
      req({
        body: {
          name: 'Vendas',
          departments: [
            { departmentId: '5', includeSubdepartments: true },
            { departmentId: '6' },
          ],
        },
      }),
      res,
    )

    expect(create).toHaveBeenCalledWith('app-1', {
      name: 'Vendas',
      memberIds: [],
      lineIds: [],
      departments: [
        { departmentId: '5', includeSubdepartments: true },
        { departmentId: '6', includeSubdepartments: false },
      ],
    })
  })

  it('recusa departamento inválido com mensagem em português', async () => {
    const create = vi.fn<AccessGroupRepository['create']>()
    const controller = new CreateAccessGroupController({ create })

    for (const departments of [[{ departmentId: '' }], ['5'], 'x']) {
      const out = await controller.perform(
        req({ body: { name: 'Vendas', departments } }),
        res,
      )
      expect(out).toEqual({
        status: 400,
        result: {
          error: 'Departamento inválido. Escolha-o novamente na lista.',
        },
      })
    }
    expect(create).not.toHaveBeenCalled()
  })

  it('recusa nome vazio com mensagem em português', async () => {
    const create = vi.fn<AccessGroupRepository['create']>()

    const out = await new CreateAccessGroupController({ create }).perform(
      req({ body: { name: '   ' } }),
      res,
    )

    expect(out).toEqual({
      status: 400,
      result: { error: 'Informe o nome do grupo.' },
    })
    expect(create).not.toHaveBeenCalled()
  })

  it('nome duplicado responde 409', async () => {
    const create = vi.fn<AccessGroupRepository['create']>(() =>
      Promise.reject(new AccessGroupNameTakenError('Vendas')),
    )

    const out = await new CreateAccessGroupController({ create }).perform(
      req({ body: { name: 'Vendas' } }),
      res,
    )

    expect(out.status).toBe(409)
  })
})

describe('UpdateAccessGroupController', () => {
  it('atualiza o grupo da rota', async () => {
    const update = vi.fn<AccessGroupRepository['update']>(() =>
      Promise.resolve(group),
    )

    const out = await new UpdateAccessGroupController({ update }).perform(
      req({ params: { groupId: 'g1' }, body: { name: 'Vendas' } }),
      res,
    )

    expect(update).toHaveBeenCalledWith('app-1', 'g1', {
      name: 'Vendas',
      memberIds: [],
      lineIds: [],
    })
    expect(out.status).toBe(200)
  })

  it('grupo inexistente responde 404 e nome duplicado 409', async () => {
    const update = vi
      .fn<AccessGroupRepository['update']>()
      .mockRejectedValueOnce(new AccessGroupNotFoundError('g1'))
      .mockRejectedValueOnce(new AccessGroupNameTakenError('X'))
    const controller = new UpdateAccessGroupController({ update })
    const request = req({ params: { groupId: 'g1' }, body: { name: 'X' } })

    expect((await controller.perform(request, res)).status).toBe(404)
    expect((await controller.perform(request, res)).status).toBe(409)
  })
})

describe('UpdateAccessGroupController (departamentos)', () => {
  it('sem o campo, não manda departamentos ao repositório', async () => {
    const update = vi.fn<AccessGroupRepository['update']>(() =>
      Promise.resolve(group),
    )

    await new UpdateAccessGroupController({ update }).perform(
      req({ params: { groupId: 'g1' }, body: { name: 'Vendas' } }),
      res,
    )

    expect(update.mock.calls[0]?.[2]).not.toHaveProperty('departments')
  })
})

describe('RemoveAccessGroupController', () => {
  it('remove e responde 404 quando não havia grupo', async () => {
    const remove = vi
      .fn<AccessGroupRepository['remove']>()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
    const controller = new RemoveAccessGroupController({ remove })
    const request = req({ params: { groupId: 'g1' } })

    expect((await controller.perform(request, res)).status).toBe(200)
    expect((await controller.perform(request, res)).status).toBe(404)
    expect(remove).toHaveBeenCalledWith('app-1', 'g1')
  })
})
