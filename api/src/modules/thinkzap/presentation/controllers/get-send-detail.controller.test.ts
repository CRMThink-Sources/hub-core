import { describe, expect, it, vi } from 'vitest'

vi.mock('@/config/env', () => ({
  env: {
    logLevel: 'silent',
    nodeEnv: 'test',
    lokiUrl: '',
    bitrix: { connector: { code: 'thinkzap' } },
  },
}))

import type { Request } from 'express'
import type {
  GetSendDetail,
  SendDetail,
} from '@/modules/thinkzap/application/get-send-detail'
import { SendNotFoundError } from '@/modules/thinkzap/domain/errors/send-not-found.error'
import { GetSendDetailController } from './get-send-detail.controller'

const detail = { id: 'row-1', text: 'olá' } as SendDetail

function makeSut() {
  const getSendDetail = {
    execute: vi.fn<GetSendDetail['execute']>().mockResolvedValue(detail),
  }
  return {
    getSendDetail,
    controller: new GetSendDetailController(getSendDetail),
  }
}

const req = (
  id: string | undefined,
  over: { admin?: boolean; user?: string | null } = {},
) =>
  ({
    query: { senderId: '99', domainId: 'outra' },
    params: { id },
    domainId: 'domain-1',
    appId: 'crmthink.thinkzap',
    bitrixUserId: over.user === null ? undefined : (over.user ?? '7'),
    thinkzapAccess: { canManageAccess: over.admin ?? false },
  }) as unknown as Request

describe('GetSendDetailController', () => {
  it('devolve o detalhe em 200 com a identidade do token', async () => {
    const { controller, getSendDetail } = makeSut()
    const response = await controller.perform(req('row-1'))
    expect(response).toEqual({ status: 200, result: detail })
    expect(getSendDetail.execute).toHaveBeenCalledWith({
      id: 'row-1',
      domainId: 'domain-1',
      appCode: 'crmthink.thinkzap',
      bitrixUserId: '7',
      isAdmin: false,
    })
  })

  it('administrador chega com isAdmin=true', async () => {
    const { controller, getSendDetail } = makeSut()
    await controller.perform(req('row-1', { admin: true }))
    expect(getSendDetail.execute.mock.calls[0]?.[0].isAdmin).toBe(true)
  })

  it('SendNotFoundError vira 404 e id inválido tem o mesmo corpo', async () => {
    const { controller, getSendDetail } = makeSut()
    getSendDetail.execute.mockRejectedValue(new SendNotFoundError())
    const denied = await controller.perform(req('de-outro'))
    const empty = await controller.perform(req(undefined))
    const huge = await controller.perform(req('x'.repeat(500)))

    expect(denied.status).toBe(404)
    expect(empty).toEqual(denied)
    expect(huge).toEqual(denied)
    expect(getSendDetail.execute).toHaveBeenCalledTimes(1)
  })

  it('erro que não é de envio inexistente não vira 404', async () => {
    const { controller, getSendDetail } = makeSut()
    getSendDetail.execute.mockRejectedValue(new Error('banco fora'))
    await expect(controller.perform(req('row-1'))).rejects.toThrow('banco fora')
  })

  it('sem usuário no token e sem ser administrador é recusado', async () => {
    const { controller, getSendDetail } = makeSut()
    const response = await controller.perform(req('row-1', { user: null }))
    expect(response.status).toBe(401)
    expect(getSendDetail.execute).not.toHaveBeenCalled()
  })
})
