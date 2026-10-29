import { beforeEach, describe, expect, it, vi } from 'vitest'

// `Controller` arrasta o logger, que lê `logLevel`/`nodeEnv` do mesmo módulo.
vi.mock('@/config/env', () => ({
  env: { logLevel: 'silent', nodeEnv: 'test', lokiUrl: '' },
}))

import { Request } from 'express'
import { GetThinkzapAccessController } from './get-thinkzap-access.controller'
import { DENIED_THINKZAP_ACCESS } from '@/modules/thinkzap/application/check-thinkzap-access'
import { FULL_THINKZAP_PERMISSIONS } from '@/modules/thinkzap/domain/thinkzap-permissions'

const req = (overrides: Partial<Request> = {}) =>
  ({
    appId: 'crmthink.thinkzap',
    domainId: 'domain-1',
    bitrixUserId: '7',
    isBitrixAdmin: false,
    bitrixDepartmentIds: [],
    ...overrides,
  }) as Request

function makeSut() {
  const getByAppCodeAndDomainId = vi
    .fn()
    .mockResolvedValue({ id: 'installed-1' })
  const getByAppIdAndBitrixUserId = vi.fn().mockResolvedValue(null)
  const getDepartmentsByAppIdAndIds = vi.fn().mockResolvedValue([])

  return {
    getByAppCodeAndDomainId,
    getByAppIdAndBitrixUserId,
    getDepartmentsByAppIdAndIds,
    controller: new GetThinkzapAccessController(
      { getByAppCodeAndDomainId } as never,
      { getByAppIdAndBitrixUserId } as never,
      { getDepartmentsByAppIdAndIds } as never,
    ),
  }
}

const allowAll = FULL_THINKZAP_PERMISSIONS

const financeOnly = {
  connectors: { read: false, create: false, update: false, delete: false },
  finance: { read: true, create: false, update: false, delete: false },
  thinkbot: {
    read: false,
    create: false,
    update: false,
    delete: false,
    publish: false,
  },
}

describe('GetThinkzapAccessController', () => {
  let sut: ReturnType<typeof makeSut>

  beforeEach(() => {
    vi.clearAllMocks()
    sut = makeSut()
  })

  it('resolve a instalação pelo par (appCodeId, domainId) do token', async () => {
    await sut.controller.perform(req())

    expect(sut.getByAppCodeAndDomainId).toHaveBeenCalledWith(
      'crmthink.thinkzap',
      'domain-1',
    )
  })

  it('devolve 404 quando não existe instalação para o par do token', async () => {
    sut.getByAppCodeAndDomainId.mockResolvedValue(null)

    const response = await sut.controller.perform(req())

    expect(response.status).toBe(404)
    expect(sut.getByAppIdAndBitrixUserId).not.toHaveBeenCalled()
  })

  it('devolve 401 quando o token não carrega o usuário do Bitrix', async () => {
    const response = await sut.controller.perform(
      req({ bitrixUserId: undefined }),
    )

    expect(response.status).toBe(401)
  })

  it('devolve permissões completas para admin do Bitrix sem consultar repositórios de permissão', async () => {
    const response = await sut.controller.perform(req({ isBitrixAdmin: true }))

    expect(response.status).toBe(200)
    expect(response.result).toEqual({
      canManageAccess: true,
      canAccess: true,
      canAccessFinance: true,
      canAccessThinkbot: true,
      permissions: FULL_THINKZAP_PERMISSIONS,
    })
    expect(sut.getByAppIdAndBitrixUserId).not.toHaveBeenCalled()
    expect(sut.getDepartmentsByAppIdAndIds).not.toHaveBeenCalled()
  })

  it('devolve as permissões do usuário permitido', async () => {
    sut.getByAppIdAndBitrixUserId.mockResolvedValue({ permissions: allowAll })

    const response = await sut.controller.perform(req())

    expect(response.status).toBe(200)
    expect(response.result).toMatchObject({
      canManageAccess: false,
      canAccess: true,
      canAccessFinance: true,
    })
  })

  describe('permissão herdada de departamento', () => {
    it('concede acesso a quem só tem permissão por departamento', async () => {
      const response = await sut.controller.perform(
        req({ bitrixDepartmentIds: ['3'] }),
      )
      expect(sut.getDepartmentsByAppIdAndIds).toHaveBeenCalledWith(
        'installed-1',
        ['3'],
      )

      sut.getDepartmentsByAppIdAndIds.mockResolvedValue([
        { permissions: financeOnly },
      ])
      const granted = await sut.controller.perform(
        req({ bitrixDepartmentIds: ['3'] }),
      )

      expect(response.result).toEqual(DENIED_THINKZAP_ACCESS)
      expect(granted.status).toBe(200)
      expect(granted.result).toMatchObject({
        canAccess: false,
        canAccessFinance: true,
        canAccessThinkbot: false,
        canManageAccess: false,
      })
    })
  })

  it('devolve 200 com o payload negado para usuário sem nada', async () => {
    const response = await sut.controller.perform(req())

    expect(response.status).toBe(200)
    expect(response.result).toEqual(DENIED_THINKZAP_ACCESS)
  })

  it('propaga falha de leitura em vez de devolver negado', async () => {
    sut.getByAppIdAndBitrixUserId.mockRejectedValue(new Error('db down'))

    await expect(sut.controller.perform(req())).rejects.toThrow('db down')
  })
})
