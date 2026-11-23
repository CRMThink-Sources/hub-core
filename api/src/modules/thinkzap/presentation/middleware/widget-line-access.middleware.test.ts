import type { NextFunction, Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'
import type { WidgetLineAccess } from '@/modules/thinkzap/application/access-group/widget-line-access'
import { LineNotAllowedError } from '@/modules/thinkzap/domain/errors/line-not-allowed.error'
import { makeWidgetLineAccessMiddleware } from './widget-line-access.middleware'

function setup(assertCanUse: WidgetLineAccess['assertCanUse']) {
  const middleware = makeWidgetLineAccessMiddleware({
    assertCanUse: vi.fn(assertCanUse),
  } as unknown as WidgetLineAccess)
  const json = vi.fn()
  const status = vi.fn(() => ({ json }))
  const res = { status } as unknown as Response
  const next = vi.fn() as unknown as NextFunction & ReturnType<typeof vi.fn>
  return { middleware, res, status, json, next }
}

const baseReq = { appId: 'thinkzap', domainId: 'd1', bitrixUserId: '7' }

describe('makeWidgetLineAccessMiddleware', () => {
  it('lê a linha do corpo e segue quando liberada', async () => {
    const assertCanUse = vi.fn(() => Promise.resolve(undefined))
    const { middleware, res, next } = setup(assertCanUse)

    await middleware(
      {
        ...baseReq,
        params: {},
        body: { subscriptionItemId: '10' },
      } as unknown as Request,
      res,
      next,
    )

    expect(assertCanUse).toHaveBeenCalledWith({
      appCode: 'thinkzap',
      domainId: 'd1',
      bitrixUserId: '7',
      subscriptionItemId: '10',
    })
    expect(next).toHaveBeenCalledWith()
  })

  it('lê a linha dos params', async () => {
    const assertCanUse = vi.fn(() => Promise.resolve(undefined))
    const { middleware, res, next } = setup(assertCanUse)

    await middleware(
      {
        ...baseReq,
        params: { subscriptionItemId: '11' },
        body: undefined,
      } as unknown as Request,
      res,
      next,
    )

    expect(assertCanUse).toHaveBeenCalledWith(
      expect.objectContaining({ subscriptionItemId: '11' }),
    )
  })

  it('responde 403 com code line-not-allowed e não segue', async () => {
    const { middleware, res, status, json, next } = setup(() =>
      Promise.reject(new LineNotAllowedError('10')),
    )

    await middleware(
      {
        ...baseReq,
        params: {},
        body: { subscriptionItemId: '10' },
      } as unknown as Request,
      res,
      next,
    )

    expect(status).toHaveBeenCalledWith(403)
    const body = json.mock.calls[0]?.[0] as {
      result: { error: string; code: string }
    }
    expect(body.result.code).toBe('line-not-allowed')
    expect(body.result.error).toContain('Você não tem acesso a esta linha')
    expect(next).not.toHaveBeenCalled()
  })

  it('sem linha legível deixa o controller validar', async () => {
    const assertCanUse = vi.fn(() => Promise.resolve(undefined))
    const { middleware, res, next } = setup(assertCanUse)

    await middleware(
      { ...baseReq, params: {}, body: {} } as unknown as Request,
      res,
      next,
    )

    expect(assertCanUse).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith()
  })

  it('repassa falha inesperada ao tratamento de erro', async () => {
    const boom = new Error('db fora')
    const { middleware, res, next } = setup(() => Promise.reject(boom))

    await middleware(
      {
        ...baseReq,
        params: {},
        body: { subscriptionItemId: '10' },
      } as unknown as Request,
      res,
      next,
    )

    expect(next).toHaveBeenCalledWith(boom)
  })
})
