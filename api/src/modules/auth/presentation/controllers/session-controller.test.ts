import { describe, expect, it, vi } from 'vitest'

// `Controller` arrasta o logger, que lê `logLevel`/`nodeEnv` do mesmo módulo.
vi.mock('@/config/env', () => ({
  env: { logLevel: 'silent', nodeEnv: 'test', lokiUrl: '' },
}))

import { Request, Response } from 'express'
import { SessionController } from './session-controller'
import type {
  SessionAuthContext,
  SessionHanderPerformer,
} from '../../infra/session-registry'

const authContext: SessionAuthContext = {
  appId: 'installed-1',
  appCodeId: 'crmthink.thinkzap',
  domainId: 'domain-1',
  bitrixUserId: '7',
  isBitrixAdmin: false,
  bitrixDepartmentIds: ['3'],
}

const req = {} as Request
const res = {} as Response

/** `perform` é genérico na interface; o teste fixa o dado e coage na saída. */
const handler = (key: string, data: unknown): SessionHanderPerformer => ({
  perform: <T>() => Promise.resolve({ key, data: data as T }),
})

describe('SessionController', () => {
  it('emite as chaves que os handlers devolvem', async () => {
    const controller = new SessionController(
      {
        appCode: 'crmthink.thinkzap',
        handlers: [
          handler('connectors', [1]),
          handler('subscription', { status: 'X' }),
        ],
      },
      authContext,
    )

    const response = await controller.perform(req, res)

    expect(response.status).toBe(200)
    expect(response.result).toEqual({
      connectors: [1],
      subscription: { status: 'X' },
    })
  })

  it('não emite app nem thinkzapAccess', async () => {
    const controller = new SessionController(
      {
        appCode: 'crmthink.thinkzap',
        handlers: [handler('connectors', [])],
      },
      authContext,
    )

    const response = await controller.perform(req, res)

    expect(response.result).not.toHaveProperty('app')
    expect(response.result).not.toHaveProperty('thinkzapAccess')
  })

  it('repassa o contexto de autenticação a todos os handlers', async () => {
    const first = vi.fn().mockResolvedValue({ key: 'connectors', data: [] })
    const second = vi
      .fn()
      .mockResolvedValue({ key: 'subscription', data: null })

    const controller = new SessionController(
      {
        appCode: 'crmthink.thinkzap',
        handlers: [{ perform: first }, { perform: second }],
      },
      authContext,
    )

    await controller.perform(req, res)

    expect(first).toHaveBeenCalledWith(authContext)
    expect(second).toHaveBeenCalledWith(authContext)
  })

  it('emite objeto vazio para app sem handlers registrados', async () => {
    const controller = new SessionController(
      { appCode: 'crmthink.clicksign', handlers: [] },
      authContext,
    )

    const response = await controller.perform(req, res)

    expect(response.status).toBe(200)
    expect(response.result).toEqual({})
  })

  it('propaga falha de handler em vez de emitir payload parcial', async () => {
    const controller = new SessionController(
      {
        appCode: 'crmthink.thinkzap',
        handlers: [{ perform: () => Promise.reject(new Error('z-api down')) }],
      },
      authContext,
    )

    await expect(controller.perform(req, res)).rejects.toThrow('z-api down')
  })
})
