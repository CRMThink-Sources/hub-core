import { beforeEach, describe, expect, it, vi } from 'vitest'

// `Controller` arrasta o logger, que lê `logLevel`/`nodeEnv` do mesmo módulo.
vi.mock('@/config/env', () => ({
  env: {
    logLevel: 'silent',
    nodeEnv: 'test',
    lokiUrl: '',
    appCodes: {
      thinkzap: 'local.marketplace.thinkzap',
      thinkanalise: 'local.marketplace.thinkanalise',
      importsheet: 'local.marketplace.importsheet',
      clicksign: 'local.marketplace.clicksign',
    },
  },
}))

import { Request } from 'express'
import { InstallController } from './install-controller'
import {
  AppCodeNotFoundError,
  InstallStepError,
} from '@/shared/application/install-app'

const validBody = {
  domain: 'acme.bitrix24.com.br',
  member_id: 'member-1',
  app_code: 'local.marketplace.thinkzap',
  email: 'admin@acme.com',
  access_token: 'access-1',
  refresh_token: 'refresh-1',
  expires_in: 3600,
}

const success = {
  domain: { id: 'domain-1', name: validBody.domain, memberId: 'member-1' },
  app: { id: 'app-1' },
  spaItemId: '4242',
}

function makeSut(execute = vi.fn().mockResolvedValue(success)) {
  return {
    execute,
    controller: new InstallController({ execute } as never),
  }
}

const req = (body: unknown) => ({ body }) as Request

describe('InstallController', () => {
  let sut: ReturnType<typeof makeSut>

  beforeEach(() => {
    sut = makeSut()
  })

  it('traduz o app_code do marketplace para o app code interno', async () => {
    await sut.controller.perform(req(validBody))

    expect(sut.execute).toHaveBeenCalledWith(
      expect.objectContaining({ appCode: 'crmthink.thinkzap' }),
    )
  })

  it('devolve 200 com domínio, app e id do item da SPA', async () => {
    const response = await sut.controller.perform(req(validBody))

    expect(response.status).toBe(200)
    expect(response.result).toMatchObject({
      id: 'domain-1',
      app: { id: 'app-1' },
      spaItemId: '4242',
    })
  })

  it.each([
    ['campo ausente', { ...validBody, email: undefined }],
    ['campo vazio', { ...validBody, domain: '' }],
    ['tipo errado', { ...validBody, expires_in: '3600' }],
  ])('devolve 400 e não chama o caso de uso: %s', async (_label, body) => {
    const response = await sut.controller.perform(req(body))

    expect(response.status).toBe(400)
    expect(sut.execute).not.toHaveBeenCalled()
  })

  it('devolve 404 e não chama o caso de uso quando o app_code é desconhecido', async () => {
    const response = await sut.controller.perform(
      req({ ...validBody, app_code: 'desconhecido' }),
    )

    expect(response.status).toBe(404)
    expect(sut.execute).not.toHaveBeenCalled()
  })

  it('devolve 404 quando o app code não existe em core_app_codes', async () => {
    sut = makeSut(
      vi
        .fn()
        .mockRejectedValue(
          new InstallStepError(
            'resolve-app-code',
            new AppCodeNotFoundError('crmthink.thinkzap'),
          ),
        ),
    )

    const response = await sut.controller.perform(req(validBody))

    expect(response.status).toBe(404)
  })

  it.each([
    ['resolve-spa-item', 502],
    ['run-installer', 502],
    ['upsert-domain', 500],
    ['upsert-app', 500],
    ['link-spa-item', 500],
  ] as const)(
    'falha em %s vira %i com o passo no corpo',
    async (step, status) => {
      sut = makeSut(
        vi
          .fn()
          .mockRejectedValue(new InstallStepError(step, new Error('deu ruim'))),
      )

      const response = await sut.controller.perform(req(validBody))

      expect(response.status).toBe(status)
      expect(response.result).toEqual({
        error: { step, message: 'deu ruim' },
      })
    },
  )

  it('deixa erro inesperado subir para o handler genérico', async () => {
    sut = makeSut(vi.fn().mockRejectedValue(new Error('boom')))

    await expect(sut.controller.perform(req(validBody))).rejects.toThrow('boom')
  })
})
