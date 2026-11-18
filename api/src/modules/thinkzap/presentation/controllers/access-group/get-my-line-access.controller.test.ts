import type { Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'
import type { WidgetLineAccess } from '@/modules/thinkzap/application/access-group/widget-line-access'
import { GetMyLineAccessController } from './get-my-line-access.controller'

const res = {} as Response

describe('GetMyLineAccessController', () => {
  it('devolve o acesso resolvido para o usuário do token', async () => {
    const resolve = vi.fn(() =>
      Promise.resolve({ restricted: true, allowedLineIds: ['1'] }),
    )
    const controller = new GetMyLineAccessController({
      resolve,
    } as unknown as WidgetLineAccess)

    const out = await controller.perform(
      { appId: 'thinkzap', domainId: 'd1', bitrixUserId: '7' } as Request,
      res,
    )

    expect(resolve).toHaveBeenCalledWith({
      appCode: 'thinkzap',
      domainId: 'd1',
      bitrixUserId: '7',
    })
    expect(out).toEqual({
      status: 200,
      result: { restricted: true, allowedLineIds: ['1'] },
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
