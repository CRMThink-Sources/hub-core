import type { Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'
import type { WidgetLineAccess } from '@/modules/thinkzap/application/access-group/widget-line-access'
import { DepartmentsUnavailableError } from '@/modules/thinkzap/domain/errors/departments-unavailable.error'
import { GetMyLineAccessController } from './get-my-line-access.controller'

const res = {} as Response
const identity = {
  appId: 'thinkzap',
  domainId: 'd1',
  bitrixUserId: '7',
  bitrixDepartmentIds: ['3'],
} as unknown as Request

describe('GetMyLineAccessController', () => {
  it('devolve o acesso resolvido para o usuário do token', async () => {
    const resolve = vi.fn(() =>
      Promise.resolve({ restricted: true, allowedLineIds: ['1'] }),
    )
    const controller = new GetMyLineAccessController({
      resolve,
    } as unknown as WidgetLineAccess)

    const out = await controller.perform(identity, res)

    expect(resolve).toHaveBeenCalledWith({
      appCode: 'thinkzap',
      domainId: 'd1',
      bitrixUserId: '7',
      bitrixDepartmentIds: ['3'],
    })
    expect(out).toEqual({
      status: 200,
      result: { restricted: true, allowedLineIds: ['1'] },
    })
  })

  it('departamentos indisponíveis respondem 503 com código próprio', async () => {
    const error = new DepartmentsUnavailableError()
    const controller = new GetMyLineAccessController({
      resolve: vi.fn(() => Promise.reject(error)),
    } as unknown as WidgetLineAccess)

    const out = await controller.perform(identity, res)

    expect(out).toEqual({
      status: 503,
      result: { error: error.message, code: 'departments-unavailable' },
    })
  })

  it('sem identidade no token responde 401', async () => {
    const resolve = vi.fn()
    const controller = new GetMyLineAccessController({
      resolve,
    } as unknown as WidgetLineAccess)

    const out = await controller.perform({} as Request, res)

    expect(out.status).toBe(401)
    expect(resolve).not.toHaveBeenCalled()
  })
})
