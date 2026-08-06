import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infra/env-config', () => ({
  envConfig: { apiUrl: 'https://api.test' },
}))

const post = vi.fn()
const isAxiosError = vi.fn(
  (e: unknown) => (e as { isAxiosError?: boolean })?.isAxiosError === true,
)
vi.mock('axios', () => ({
  default: {
    post: (...args: unknown[]) => post(...args) as unknown,
    isAxiosError: (e: unknown) => isAxiosError(e),
  },
}))

const fetchAppInfoFromCallMethod = vi.fn()
const fetchCurrentUserFromCallMethod = vi.fn()
const getBitrixAppInfoFromUrl = vi.fn()
vi.mock('./app-info', () => ({
  fetchAppInfoFromCallMethod: () =>
    fetchAppInfoFromCallMethod() as Promise<unknown>,
  fetchCurrentUserFromCallMethod: () =>
    fetchCurrentUserFromCallMethod() as Promise<unknown>,
  getBitrixAppInfoFromUrl: () => getBitrixAppInfoFromUrl() as unknown,
}))

import {
  authenticateBitrixWithBackend,
  registerOperatorOAuth,
} from './authenticate-with-backend'

const resolvedApp = {
  appCode: 'crmthink.thinkzap',
  appCodeId: 'crmthink.thinkzap',
  slug: 'thinkzap',
  requiresOperatorOAuth: true,
}

const axiosError = (status: number, data?: unknown) => ({
  isAxiosError: true,
  message: 'request failed',
  response: { status, data },
})

const originalWindow = globalThis.window

beforeEach(() => {
  vi.clearAllMocks()
  getBitrixAppInfoFromUrl.mockReturnValue({
    domain: 'acme.bitrix24.com.br',
    member_id: 'member-1',
    urlParams: { USER_ID: '9' },
  })
  fetchAppInfoFromCallMethod.mockResolvedValue({
    CODE: 'local.marketplace.thinkzap',
  })
  fetchCurrentUserFromCallMethod.mockResolvedValue({ ID: 7, NAME: 'Ana' })
  post.mockResolvedValue({
    data: { result: { token: 'jwt-1', app: resolvedApp } },
  })

  Object.defineProperty(globalThis, 'window', {
    value: {
      BX24: {
        getAuth: () => ({
          access_token: 'access-1',
          refresh_token: 'refresh-1',
          expires_in: 3600,
          member_id: 'member-1',
        }),
        isAdmin: () => true,
      },
    },
    configurable: true,
    writable: true,
  })
})

afterEach(() => {
  Object.defineProperty(globalThis, 'window', {
    value: originalWindow,
    configurable: true,
    writable: true,
  })
})

describe('authenticateBitrixWithBackend', () => {
  it('devolve token, identidade da app e contexto do Bitrix', async () => {
    const result = await authenticateBitrixWithBackend()

    expect(result).toEqual({
      ok: true,
      token: 'jwt-1',
      app: resolvedApp,
      bitrix: {
        domain: 'acme.bitrix24.com.br',
        bitrixUserId: '7',
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        expiresIn: 3600,
      },
    })
  })

  it('envia o code do marketplace vindo de app.info', async () => {
    await authenticateBitrixWithBackend()

    expect(post).toHaveBeenCalledWith(
      'https://api.test/auth',
      expect.objectContaining({ app_code: 'local.marketplace.thinkzap' }),
    )
  })

  it('não grava token nem chama bitrix-oauth', async () => {
    await authenticateBitrixWithBackend()

    expect(post).toHaveBeenCalledTimes(1)
    expect(post).not.toHaveBeenCalledWith(
      'https://api.test/auth/bitrix-oauth',
      expect.anything(),
    )
  })

  it('cai para o USER_ID da URL quando user.current falha', async () => {
    fetchCurrentUserFromCallMethod.mockRejectedValue(new Error('sem escopo'))

    const result = await authenticateBitrixWithBackend()

    expect(result).toMatchObject({ ok: true })
    expect(post).toHaveBeenCalledWith(
      'https://api.test/auth',
      expect.objectContaining({ bitrix_user_id: '9' }),
    )
  })

  describe('falhas', () => {
    it('sinaliza outside-bitrix quando falta DOMAIN na URL', async () => {
      getBitrixAppInfoFromUrl.mockReturnValue({})

      const result = await authenticateBitrixWithBackend()

      expect(result).toMatchObject({ ok: false, reason: 'outside-bitrix' })
      expect(post).not.toHaveBeenCalled()
    })

    it('sinaliza missing-bitrix-auth quando BX24.getAuth não devolve credencial', async () => {
      ;(
        window as unknown as { BX24: { getAuth: () => unknown } }
      ).BX24.getAuth = () => false

      const result = await authenticateBitrixWithBackend()

      expect(result).toMatchObject({ ok: false, reason: 'missing-bitrix-auth' })
    })

    it('sinaliza app-info-unavailable quando app.info falha', async () => {
      fetchAppInfoFromCallMethod.mockRejectedValue(new Error('sem bridge'))

      const result = await authenticateBitrixWithBackend()

      expect(result).toMatchObject({
        ok: false,
        reason: 'app-info-unavailable',
      })
      expect(post).not.toHaveBeenCalled()
    })

    it('sinaliza app-info-unavailable quando app.info não devolve CODE', async () => {
      fetchAppInfoFromCallMethod.mockResolvedValue({})

      const result = await authenticateBitrixWithBackend()

      expect(result).toMatchObject({
        ok: false,
        reason: 'app-info-unavailable',
      })
    })

    it('sinaliza unknown-bitrix-user quando não há id de usuário', async () => {
      fetchCurrentUserFromCallMethod.mockResolvedValue({})
      getBitrixAppInfoFromUrl.mockReturnValue({
        domain: 'acme.bitrix24.com.br',
      })

      const result = await authenticateBitrixWithBackend()

      expect(result).toMatchObject({ ok: false, reason: 'unknown-bitrix-user' })
    })

    it('mapeia 404 do backend para unknown-app com a mensagem do backend', async () => {
      post.mockRejectedValue(
        axiosError(404, {
          result: { error: 'Aplicação não reconhecida: "x"' },
        }),
      )

      const result = await authenticateBitrixWithBackend()

      expect(result).toEqual({
        ok: false,
        reason: 'unknown-app',
        error: 'Aplicação não reconhecida: "x"',
      })
    })

    it('mapeia outros erros do backend para backend-error', async () => {
      post.mockRejectedValue(axiosError(500, { error: { message: 'boom' } }))

      const result = await authenticateBitrixWithBackend()

      expect(result).toMatchObject({ ok: false, reason: 'backend-error' })
    })

    it('falha quando a resposta não traz token', async () => {
      post.mockResolvedValue({ data: { result: { app: resolvedApp } } })

      const result = await authenticateBitrixWithBackend()

      expect(result).toMatchObject({ ok: false, reason: 'backend-error' })
    })

    it('falha com unknown-app quando a resposta não traz a identidade da app', async () => {
      post.mockResolvedValue({ data: { result: { token: 'jwt-1' } } })

      const result = await authenticateBitrixWithBackend()

      expect(result).toMatchObject({ ok: false, reason: 'unknown-app' })
    })

    it('falha com unknown-app quando a identidade vem incompleta', async () => {
      post.mockResolvedValue({
        data: { result: { token: 'jwt-1', app: { appCode: 'x' } } },
      })

      const result = await authenticateBitrixWithBackend()

      expect(result).toMatchObject({ ok: false, reason: 'unknown-app' })
    })
  })
})

describe('registerOperatorOAuth', () => {
  const bitrix = {
    domain: 'acme.bitrix24.com.br',
    bitrixUserId: '7',
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    expiresIn: 3600,
  }

  it('registra o refresh token do operador', async () => {
    await registerOperatorOAuth('crmthink.thinkzap', bitrix)

    expect(post).toHaveBeenCalledWith('https://api.test/auth/bitrix-oauth', {
      domain: 'acme.bitrix24.com.br',
      app_code: 'crmthink.thinkzap',
      bitrix_user_id: '7',
      access_token: 'access-1',
      refresh_token: 'refresh-1',
      expires_in: 3600,
    })
  })

  it('não chama a API quando o Bitrix não devolveu refresh token', async () => {
    await registerOperatorOAuth('crmthink.thinkzap', {
      ...bitrix,
      refreshToken: undefined,
    })

    expect(post).not.toHaveBeenCalled()
  })
})
