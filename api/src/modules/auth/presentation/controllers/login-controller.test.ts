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

const resolveBitrixUserAtLogin = vi.fn()
vi.mock('../../application/resolve-bitrix-user-at-login', () => ({
  resolveBitrixUserAtLogin: (...args: unknown[]) =>
    resolveBitrixUserAtLogin(...args) as unknown,
}))

import { Request } from 'express'
import { LoginController } from './login-controller'

const validBody = {
  domain: 'acme.bitrix24.com.br',
  member_id: 'member-1',
  app_code: 'local.marketplace.thinkzap',
  access_token: 'access-1',
  bitrix_user_id: '7',
  is_bitrix_admin: true,
}

const req = (body: unknown) => ({ body }) as Request

function makeSut() {
  const getAvailableApp = vi
    .fn()
    .mockResolvedValue({ id: 'crmthink.thinkzap', code: 'crmthink.thinkzap' })
  const upsertDomain = vi.fn().mockResolvedValue({ id: 'domain-1' })
  const generateToken = vi.fn().mockReturnValue({ token: 'jwt-1' })

  return {
    getAvailableApp,
    upsertDomain,
    generateToken,
    controller: new LoginController(
      { getById: getAvailableApp } as never,
      { execute: upsertDomain } as never,
      { generateToken } as never,
    ),
  }
}

describe('LoginController', () => {
  let sut: ReturnType<typeof makeSut>

  beforeEach(() => {
    vi.clearAllMocks()
    resolveBitrixUserAtLogin.mockResolvedValue({
      bitrixUserId: '7',
      displayName: 'Ana',
      email: 'ana@acme.com',
      isBitrixAdmin: true,
      bitrixDepartmentIds: ['3'],
    })
    sut = makeSut()
  })

  it('devolve 201 com token e a identidade da aplicação', async () => {
    const response = await sut.controller.perform(req(validBody))

    expect(response.status).toBe(201)
    expect(response.result).toEqual({
      token: 'jwt-1',
      app: {
        appCode: 'crmthink.thinkzap',
        appCodeId: 'crmthink.thinkzap',
        slug: 'thinkzap',
        requiresOperatorOAuth: true,
      },
    })
  })

  it('resolve o app code do marketplace pelo catálogo', async () => {
    await sut.controller.perform(req(validBody))

    expect(sut.getAvailableApp).toHaveBeenCalledWith('crmthink.thinkzap')
  })

  it('marca requiresOperatorOAuth como false para app que não usa OAuth de operador', async () => {
    const response = await sut.controller.perform(
      req({ ...validBody, app_code: 'local.marketplace.importsheet' }),
    )

    expect(response.result).toMatchObject({
      app: { slug: 'importsheet', requiresOperatorOAuth: false },
    })
  })

  describe('aplicação não reconhecida', () => {
    it('devolve 404 para app code fora do catálogo', async () => {
      const response = await sut.controller.perform(
        req({ ...validBody, app_code: 'outro.app' }),
      )

      expect(response.status).toBe(404)
      expect((response.result as { error: string }).error).toContain(
        'não reconhecida',
      )
    })

    it('devolve 404 para app code vazio', async () => {
      const response = await sut.controller.perform(
        req({ ...validBody, app_code: '' }),
      )

      expect(response.status).toBe(404)
    })

    it('não emite token nem escreve domínio quando a app não é reconhecida', async () => {
      await sut.controller.perform(req({ ...validBody, app_code: 'outro.app' }))

      expect(sut.upsertDomain).not.toHaveBeenCalled()
      expect(sut.generateToken).not.toHaveBeenCalled()
      expect(sut.getAvailableApp).not.toHaveBeenCalled()
    })
  })

  it('devolve 400 quando o payload é inválido', async () => {
    const response = await sut.controller.perform(
      req({ ...validBody, access_token: '' }),
    )

    expect(response.status).toBe(400)
  })

  it('devolve 404 quando a app não existe em core_app_codes', async () => {
    sut.getAvailableApp.mockResolvedValue(null)

    const response = await sut.controller.perform(req(validBody))

    expect(response.status).toBe(404)
    expect(sut.generateToken).not.toHaveBeenCalled()
  })

  it('gera o token com o appCodeId do catálogo e o domínio persistido', async () => {
    await sut.controller.perform(req(validBody))

    expect(sut.generateToken).toHaveBeenCalledWith({
      domainId: 'domain-1',
      appCodeId: 'crmthink.thinkzap',
      bitrixUserId: '7',
      isBitrixAdmin: true,
      bitrixDepartmentIds: ['3'],
    })
  })

  it('devolve 400 quando o usuário do Bitrix não pode ser resolvido', async () => {
    resolveBitrixUserAtLogin.mockRejectedValue(new Error('sem usuário'))

    const response = await sut.controller.perform(req(validBody))

    expect(response.status).toBe(400)
    expect(sut.generateToken).not.toHaveBeenCalled()
  })
})
