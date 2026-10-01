import type { Request } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  NEED_OPERATOR_OAUTH,
  SendOpenChannelButtonController,
  type CreateBitrixClientWithUserToken,
  type ResolveOperatorBitrixAccessToken,
} from './send-open-channel-button.controller'
import type { GetDomainRepository } from '@/shared/domain/repositories/domain/get-domain.repository'
import { BitrixError } from '@/shared/infra/clients/errors/bitrix-client.error'
import { createHash } from 'node:crypto'
import { decodeButtonActionCode } from '@/modules/thinkzap/application/parse-button-action-code'

describe('SendOpenChannelButtonController', () => {
  const iframeHash = '0e9c40cee01d6f182e9261b38b30b5c3'
  const domain = 'crmthink.bitrix24.com.br'
  const userId = '2'

  const getDomain = vi.fn()
  const getDomainRepository: GetDomainRepository = {
    getDomainById: vi.fn(),
    getDomain,
  }

  const callMethod = vi.fn()
  const createClient: CreateBitrixClientWithUserToken = vi.fn(() => ({
    callMethod,
  }))
  const resolveOperatorAccessToken: ResolveOperatorBitrixAccessToken = vi.fn()

  const controller = new SendOpenChannelButtonController(
    getDomainRepository,
    createClient,
    resolveOperatorAccessToken,
    iframeHash,
  )

  function makeImbotAuthBody(overrides: Record<string, unknown> = {}) {
    const domainHash = createHash('md5')
      .update(`${domain}${iframeHash}`)
      .digest('hex')
    const userHash = createHash('md5')
      .update(`${userId}${iframeHash}`)
      .digest('hex')

    return {
      dialogId: 'chat80619',
      domain: `https://${domain}`,
      userId,
      userHash,
      domainHash,
      body: 'Escolha uma opção',
      buttons: [{ id: '1', label: 'Sim', type: 'REPLY' }],
      ...overrides,
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    getDomain.mockResolvedValue({
      id: 'domain-1',
      name: domain,
      memberId: 'member-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    callMethod.mockResolvedValue({})
    vi.mocked(resolveOperatorAccessToken).mockResolvedValue('operator-token')
  })

  function makeRequest(body: Record<string, unknown>) {
    return { body } as Request
  }

  it('returns 400 when auth payload is missing', async () => {
    const response = await controller.perform(
      makeRequest({
        dialogId: 'chat80619',
        domain,
        body: 'Escolha uma opção',
        buttons: [{ id: '1', label: 'Sim', type: 'REPLY' }],
      }),
      {} as never,
    )

    expect(response.status).toBe(400)
    expect(createClient).not.toHaveBeenCalled()
  })

  it('returns 400 when buttons are missing', async () => {
    const response = await controller.perform(
      makeRequest({
        dialogId: 'chat80619',
        domain,
        accessToken: 'operator-token',
        body: 'Escolha uma opção',
        buttons: [],
      }),
      {} as never,
    )

    expect(response.status).toBe(400)
    expect(createClient).not.toHaveBeenCalled()
  })

  it('returns 404 when domain does not exist', async () => {
    getDomain.mockResolvedValue(null)

    const response = await controller.perform(
      makeRequest({
        dialogId: 'chat80619',
        domain: 'unknown.bitrix24.com.br',
        accessToken: 'operator-token',
        body: 'Escolha uma opção',
        buttons: [{ id: '1', label: 'Sim', type: 'REPLY' }],
      }),
      {} as never,
    )

    expect(response.status).toBe(404)
    expect(createClient).not.toHaveBeenCalled()
  })

  it('posts the encoded button code via im.message.add using operator token', async () => {
    const response = await controller.perform(
      makeRequest({
        dialogId: 'chat80619',
        domain,
        accessToken: 'operator-token',
        body: 'Escolha uma opção',
        header: 'Título',
        footer: 'Rodapé',
        buttons: [{ id: '1', label: 'Sim', type: 'REPLY' }],
      }),
      {} as never,
    )

    expect(createClient).toHaveBeenCalledWith(domain, 'operator-token')
    expect(resolveOperatorAccessToken).not.toHaveBeenCalled()
    expect(callMethod).toHaveBeenCalledTimes(1)

    const [method, params] = callMethod.mock.calls[0] as [
      string,
      { DIALOG_ID: string; MESSAGE: string },
    ]
    expect(method).toBe('im.message.add')
    expect(params.DIALOG_ID).toBe('chat80619')

    const decoded = decodeButtonActionCode(params.MESSAGE)
    expect(decoded).toEqual({
      body: 'Escolha uma opção',
      header: 'Título',
      footer: 'Rodapé',
      buttons: [{ id: '1', label: 'Sim', type: 'REPLY' }],
    })

    expect(response.status).toBe(200)
  })

  it('posts using resolved operator token after imbot hash validation', async () => {
    const response = await controller.perform(
      makeRequest(makeImbotAuthBody()),
      {} as never,
    )

    expect(resolveOperatorAccessToken).toHaveBeenCalledWith(domain, userId)
    expect(createClient).toHaveBeenCalledWith(domain, 'operator-token')
    expect(response.status).toBe(200)
  })

  it('returns 401 NEED_OPERATOR_OAUTH when operator token is missing', async () => {
    vi.mocked(resolveOperatorAccessToken).mockResolvedValue(null)

    const response = await controller.perform(
      makeRequest(makeImbotAuthBody()),
      {} as never,
    )

    expect(response.status).toBe(401)
    expect(response.result).toMatchObject({ code: NEED_OPERATOR_OAUTH })
    expect(createClient).not.toHaveBeenCalled()
  })

  it('returns 401 when imbot iframe hash is invalid', async () => {
    const response = await controller.perform(
      makeRequest(makeImbotAuthBody({ userHash: 'invalid' })),
      {} as never,
    )

    expect(response.status).toBe(401)
    expect(resolveOperatorAccessToken).not.toHaveBeenCalled()
  })

  it('responde 502 catalogado quando o im.message.add falha', async () => {
    callMethod.mockRejectedValue(
      new BitrixError('Bitrix error: 403 - {"error":"ACCESS_DENIED"}'),
    )

    const response = await controller.perform(
      makeRequest({
        dialogId: 'chat80619',
        domain,
        accessToken: 'operator-token',
        body: 'Escolha uma opção',
        buttons: [{ id: '1', label: 'Sim', type: 'REPLY' }],
      }),
      {} as never,
    )

    expect(response.status).toBe(502)
  })
})
