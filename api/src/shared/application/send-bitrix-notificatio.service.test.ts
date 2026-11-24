import { describe, expect, it, vi } from 'vitest'
import type { BitrixClient } from '../infra/clients/bitrix.client'
import {
  BitrixLivefeedNotificationService,
  isAuthorRefusal,
  type TimelineAuthorResolver,
} from './send-bitrix-notificatio.service'

type CallMethod = BitrixClient['callMethod']
type AuthorClient = Pick<BitrixClient, 'callMethod'>

/** `expect.objectContaining` devolve `any`; aqui entra como `unknown`. */
const containing = (value: Record<string, unknown>): unknown =>
  expect.objectContaining(value)

/** O `callMethod` é genérico: a resposta de teste entra sem tipo. */
const reply = (value: unknown) => Promise.resolve(value as never)

function setup(resolveImpl?: TimelineAuthorResolver) {
  const installationCall = vi.fn<CallMethod>().mockResolvedValue({})
  const authorCall = vi.fn<CallMethod>().mockResolvedValue({ result: 1 })
  const resolver = vi.fn<TimelineAuthorResolver>(
    resolveImpl ??
      (() =>
        Promise.resolve({ callMethod: authorCall } as unknown as AuthorClient)),
  )
  const service = new BitrixLivefeedNotificationService(
    { callMethod: installationCall } as unknown as BitrixClient,
    resolver,
  )
  return { service, installationCall, authorCall, resolver }
}

const base = { contextId: '10', entity: 'deal', message: 'oi' }
const commentCall = {
  fields: { ENTITY_ID: 10, ENTITY_TYPE: 'DEAL', COMMENT: 'oi' },
}

describe('BitrixLivefeedNotificationService', () => {
  it('publica em nome do remetente quando há token dele', async () => {
    const { service, authorCall, installationCall } = setup()

    await service.execute({ ...base, authorBitrixUserId: '7' })

    expect(authorCall).toHaveBeenCalledWith(
      'crm.timeline.comment.add',
      commentCall,
    )
    expect(installationCall).not.toHaveBeenCalled()
  })

  it('sem autor, publica com a credencial da instalação sem consultar token', async () => {
    const { service, installationCall, resolver } = setup()

    await service.execute(base)

    expect(resolver).not.toHaveBeenCalled()
    expect(installationCall).toHaveBeenCalledWith(
      'crm.timeline.comment.add',
      commentCall,
    )
  })

  it('sem token do remetente, cai na instalação e nomeia o remetente no texto', async () => {
    const { service, installationCall } = setup(() => Promise.resolve(null))
    installationCall.mockImplementation(method =>
      reply(
        method === 'user.get'
          ? { result: [{ NAME: 'Ana', LAST_NAME: 'Souza' }] }
          : {},
      ),
    )

    await service.execute({
      ...base,
      authorBitrixUserId: '7',
      senderLine: name => `Enviado por: ${name}`,
    })

    expect(installationCall).toHaveBeenCalledWith('user.get', { ID: '7' })
    expect(installationCall).toHaveBeenCalledWith('crm.timeline.comment.add', {
      fields: containing({ COMMENT: 'oi\nEnviado por: Ana Souza' }),
    })
  })

  it('falha ao obter o nome só omite a linha do remetente', async () => {
    const { service, installationCall } = setup(() => Promise.resolve(null))
    installationCall.mockImplementation(method =>
      method === 'user.get'
        ? Promise.reject(new Error('sem escopo'))
        : reply({}),
    )

    await service.execute({
      ...base,
      authorBitrixUserId: '7',
      senderLine: name => `Enviado por: ${name}`,
    })

    expect(installationCall).toHaveBeenCalledWith('crm.timeline.comment.add', {
      fields: containing({ COMMENT: 'oi' }),
    })
  })

  it('renovação do token que lança vira fallback, sem lançar', async () => {
    const { service, installationCall } = setup(() =>
      Promise.reject(new Error('refresh falhou')),
    )

    await expect(
      service.execute({ ...base, authorBitrixUserId: '7' }),
    ).resolves.toBeUndefined()

    expect(installationCall).toHaveBeenCalledWith(
      'crm.timeline.comment.add',
      commentCall,
    )
  })

  it('acesso negado ao token do remetente publica uma vez com a instalação', async () => {
    const { service, authorCall, installationCall } = setup()
    authorCall.mockRejectedValue(
      new Error('Bitrix error: 403 - {"error":"ACCESS_DENIED"}'),
    )

    await service.execute({ ...base, authorBitrixUserId: '7' })

    expect(authorCall).toHaveBeenCalledTimes(1)
    expect(installationCall).toHaveBeenCalledTimes(1)
  })

  it('erro ambíguo (rede) não repete: evita comentário duplicado', async () => {
    const { service, authorCall, installationCall } = setup()
    authorCall.mockRejectedValue(new Error('timeout of 30000ms exceeded'))

    await expect(
      service.execute({ ...base, authorBitrixUserId: '7' }),
    ).resolves.toBeUndefined()

    expect(installationCall).not.toHaveBeenCalled()
  })

  it('resposta 200 com erro de token cai na instalação', async () => {
    const { service, authorCall, installationCall } = setup()
    authorCall.mockResolvedValue({ error: 'expired_token' })

    await service.execute({ ...base, authorBitrixUserId: '7' })

    expect(installationCall).toHaveBeenCalledWith(
      'crm.timeline.comment.add',
      commentCall,
    )
  })

  it('entidade inválida não chama o Bitrix', async () => {
    const { service, installationCall, authorCall } = setup()

    await service.execute({ ...base, contextId: 'abc' })

    expect(installationCall).not.toHaveBeenCalled()
    expect(authorCall).not.toHaveBeenCalled()
  })
})

describe('isAuthorRefusal', () => {
  it.each([
    'Bitrix error: 401 - {"error":"expired_token"}',
    'Bitrix error: 403 - {}',
    'ACCESS_DENIED',
  ])('reconhece %s', text => {
    expect(isAuthorRefusal(new Error(text))).toBe(true)
  })

  it.each(['timeout of 30000ms exceeded', 'Bitrix error: 500 - {}'])(
    'não trata %s como recusa',
    text => {
      expect(isAuthorRefusal(new Error(text))).toBe(false)
    },
  )
})
