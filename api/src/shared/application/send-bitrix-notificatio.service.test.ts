import { describe, expect, it, vi } from 'vitest'
import { BitrixMethodPausedError } from '../infra/bitrix-limits/bitrix-limits.port'
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

/** Recusas em que o Bitrix com certeza não gravou nada. */
const paused = () =>
  new BitrixMethodPausedError(
    'crm.timeline.comment.add',
    'x.bitrix24.com.br',
    Date.now() + 60_000,
  )
const queryLimit = () =>
  new Error('Bitrix error: 503 - {"error":"QUERY_LIMIT_EXCEEDED"}')
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

  it.each([
    ['pausa', paused],
    ['limite de intensidade', queryLimit],
  ])('%s no Bitrix segue engolida para quem só publica', async (_, error) => {
    const { service, installationCall } = setup()
    installationCall.mockRejectedValue(error())

    await expect(service.execute(base)).resolves.toBeUndefined()
  })

  it('entidade inválida não chama o Bitrix', async () => {
    const { service, installationCall, authorCall } = setup()

    await service.execute({ ...base, contextId: 'abc' })

    expect(installationCall).not.toHaveBeenCalled()
    expect(authorCall).not.toHaveBeenCalled()
  })
})

describe('publish', () => {
  it('devolve o id do comentário publicado em nome do remetente', async () => {
    const { service, authorCall } = setup()
    authorCall.mockResolvedValue({ result: 77 })

    await expect(
      service.publish({ ...base, authorBitrixUserId: '7' }),
    ).resolves.toEqual({ commentId: '77', asAuthor: true })
  })

  it('devolve o id marcando a credencial da instalação', async () => {
    const { service, installationCall } = setup()
    installationCall.mockResolvedValue({ result: 78 })

    await expect(service.publish(base)).resolves.toEqual({
      commentId: '78',
      asAuthor: false,
    })
  })

  it('erro de rede devolve null sem segunda chamada', async () => {
    const { service, authorCall, installationCall } = setup()
    authorCall.mockRejectedValue(new Error('timeout of 30000ms exceeded'))

    await expect(
      service.publish({ ...base, authorBitrixUserId: '7' }),
    ).resolves.toBeNull()

    expect(authorCall).toHaveBeenCalledTimes(1)
    expect(installationCall).not.toHaveBeenCalled()
  })

  it('erro de rede na instalação devolve null sem repetir', async () => {
    const { service, installationCall } = setup()
    installationCall.mockRejectedValue(new Error('socket hang up'))

    await expect(service.publish(base)).resolves.toBeNull()

    expect(installationCall).toHaveBeenCalledTimes(1)
  })

  it('resposta 200 com erro na instalação devolve null', async () => {
    const { service, installationCall } = setup()
    installationCall.mockResolvedValue({ error: 'ACCESS_DENIED' })

    await expect(service.publish(base)).resolves.toBeNull()
  })

  it('resposta sem id devolve null sem publicar de novo', async () => {
    const { service, authorCall, installationCall } = setup()
    authorCall.mockResolvedValue({})

    await expect(
      service.publish({ ...base, authorBitrixUserId: '7' }),
    ).resolves.toBeNull()

    expect(installationCall).not.toHaveBeenCalled()
  })

  it.each([
    ['pausa', paused],
    ['limite de intensidade', queryLimit],
  ])('%s como autor sobe, sem tentar a instalação', async (_, error) => {
    const { service, authorCall, installationCall } = setup()
    const refusal = error()
    authorCall.mockRejectedValue(refusal)

    await expect(
      service.publish({ ...base, authorBitrixUserId: '7' }),
    ).rejects.toBe(refusal)

    expect(installationCall).not.toHaveBeenCalled()
  })

  it.each([
    ['pausa', paused],
    ['limite de intensidade', queryLimit],
  ])('%s na instalação sobe: nada foi gravado', async (_, error) => {
    const { service, installationCall } = setup()
    const refusal = error()
    installationCall.mockRejectedValue(refusal)

    await expect(service.publish(base)).rejects.toBe(refusal)
  })

  it('pausa só no nome do remetente publica sem a linha dele', async () => {
    const { service, installationCall } = setup(() => Promise.resolve(null))
    installationCall.mockImplementation(method =>
      method === 'user.get' ? Promise.reject(paused()) : reply({ result: 5 }),
    )

    await expect(
      service.publish({
        ...base,
        authorBitrixUserId: '7',
        senderLine: name => `Enviado por: ${name}`,
      }),
    ).resolves.toEqual({ commentId: '5', asAuthor: false })
    expect(installationCall).toHaveBeenCalledWith('crm.timeline.comment.add', {
      fields: containing({ COMMENT: 'oi' }),
    })
  })

  it('entidade inválida devolve null', async () => {
    const { service } = setup()

    await expect(
      service.publish({ ...base, contextId: 'abc' }),
    ).resolves.toBeNull()
  })
})

describe('update', () => {
  const byAuthor = {
    ...base,
    message: 'novo',
    commentId: '77',
    asAuthor: true,
    authorBitrixUserId: '7',
    senderLine: (name: string) => `Enviado por: ${name}`,
  }
  const byInstallation = { ...byAuthor, asAuthor: false }
  const updateCall = (comment: string) => ({
    id: 77,
    fields: { COMMENT: comment },
  })
  /** Formato com que o `BitrixClient` lança a resposta de erro do Bitrix. */
  const bitrixFailure = (status: number, code: string) =>
    new Error(`Bitrix error: ${status} - {"error":"${code}"}`)
  const withUser = (updateReply: () => Promise<never>): CallMethod =>
    (method => {
      if (method !== 'user.get') return updateReply()
      return reply({ result: [{ NAME: 'Ana', LAST_NAME: 'Souza' }] })
    }) as CallMethod

  it('edita com o token do autor, sem linha de remetente', async () => {
    const { service, authorCall, installationCall } = setup()

    await expect(service.update(byAuthor)).resolves.toBe(true)

    expect(authorCall).toHaveBeenCalledWith(
      'crm.timeline.comment.update',
      updateCall('novo'),
    )
    expect(installationCall).not.toHaveBeenCalled()
  })

  it('mantém o ícone da marca', async () => {
    const call = vi.fn<CallMethod>().mockResolvedValue({ result: 77 })
    const service = new BitrixLivefeedNotificationService(
      { callMethod: call } as unknown as BitrixClient,
      undefined,
      'https://app.exemplo.com/icone.png',
    )

    await service.update({ ...base, commentId: '77', asAuthor: false })

    expect(call).toHaveBeenCalledWith(
      'crm.timeline.comment.update',
      updateCall(
        '[IMG WIDTH=16 HEIGHT=16]https://app.exemplo.com/icone.png[/IMG] oi',
      ),
    )
  })

  it('comentário da instalação é editado por ela, sem consultar token', async () => {
    const { service, installationCall, resolver } = setup()
    installationCall.mockImplementation(withUser(() => reply({ result: 77 })))

    await expect(service.update(byInstallation)).resolves.toBe(true)

    expect(resolver).not.toHaveBeenCalled()
    expect(installationCall).toHaveBeenCalledWith(
      'crm.timeline.comment.update',
      updateCall('novo\nEnviado por: Ana Souza'),
    )
  })

  it.each([
    ['lançada', () => Promise.reject(bitrixFailure(403, 'ACCESS_DENIED'))],
    ['no corpo', () => reply({ error: 'expired_token' })],
  ])('recusa do autor %s repete pela instalação', async (_, refusal) => {
    const { service, authorCall, installationCall } = setup()
    authorCall.mockImplementation(refusal)
    installationCall.mockImplementation(withUser(() => reply({ result: 77 })))

    await expect(service.update(byAuthor)).resolves.toBe(true)

    expect(installationCall).toHaveBeenCalledWith(
      'crm.timeline.comment.update',
      updateCall('novo\nEnviado por: Ana Souza'),
    )
  })

  it.each([
    ['sem token', () => Promise.resolve(null)],
    ['com renovação falhando', () => Promise.reject(new Error('refresh'))],
  ])('autor %s edita pela instalação', async (_, resolve) => {
    const { service, installationCall } = setup(resolve)
    installationCall.mockImplementation(withUser(() => reply({ result: 77 })))

    await expect(service.update(byAuthor)).resolves.toBe(true)

    expect(installationCall).toHaveBeenCalledWith(
      'crm.timeline.comment.update',
      updateCall('novo\nEnviado por: Ana Souza'),
    )
  })

  it.each([
    ['lançado', () => Promise.reject(bitrixFailure(400, 'NOT_FOUND'))],
    ['no corpo', () => reply({ error: 'NOT_FOUND' })],
  ])('NOT_FOUND %s ao autor devolve false', async (_, gone) => {
    const { service, authorCall, installationCall } = setup()
    authorCall.mockImplementation(gone)

    await expect(service.update(byAuthor)).resolves.toBe(false)

    expect(installationCall).not.toHaveBeenCalled()
  })

  it.each([
    ['lançado', () => Promise.reject(bitrixFailure(400, 'NOT_FOUND'))],
    ['no corpo', () => reply({ error: 'NOT_FOUND' })],
  ])('NOT_FOUND %s à instalação devolve false', async (_, gone) => {
    const { service, installationCall } = setup()
    installationCall.mockImplementation(gone)

    await expect(
      service.update({ ...base, commentId: '77', asAuthor: false }),
    ).resolves.toBe(false)
  })

  it.each(['ERROR_METHOD_NOT_FOUND', 'OWNER_NOT_FOUND'])(
    '%s não é comentário apagado',
    async code => {
      const { service, installationCall } = setup()
      installationCall.mockRejectedValue(bitrixFailure(404, code))

      await expect(
        service.update({ ...base, commentId: '77', asAuthor: false }),
      ).rejects.toThrow(code)
    },
  )

  it('falha ao obter o nome do remetente rejeita, para não gravar sem ele', async () => {
    const { service, installationCall } = setup()
    installationCall.mockImplementation(method =>
      method === 'user.get'
        ? Promise.reject(new Error('timeout of 30000ms exceeded'))
        : reply({ result: 77 }),
    )

    await expect(service.update(byInstallation)).rejects.toThrow('timeout')

    expect(installationCall).not.toHaveBeenCalledWith(
      'crm.timeline.comment.update',
      expect.anything(),
    )
  })

  it('remetente sem nome no Bitrix edita sem a linha dele', async () => {
    const { service, installationCall } = setup()
    installationCall.mockImplementation(method =>
      reply(method === 'user.get' ? { result: [] } : { result: 77 }),
    )

    await expect(service.update(byInstallation)).resolves.toBe(true)

    expect(installationCall).toHaveBeenCalledWith(
      'crm.timeline.comment.update',
      updateCall('novo'),
    )
  })

  it('pausa como autor sobe sem trocar de credencial', async () => {
    const { service, authorCall, installationCall } = setup()
    const refusal = paused()
    authorCall.mockRejectedValue(refusal)

    await expect(service.update(byAuthor)).rejects.toBe(refusal)

    expect(installationCall).not.toHaveBeenCalled()
  })

  it('erro de rede como autor rejeita sem trocar de credencial', async () => {
    const { service, authorCall, installationCall } = setup()
    authorCall.mockRejectedValue(new Error('timeout of 30000ms exceeded'))

    await expect(service.update(byAuthor)).rejects.toThrow('timeout')

    expect(installationCall).not.toHaveBeenCalled()
  })

  it('erro de rede na instalação rejeita', async () => {
    const { service, installationCall } = setup()
    installationCall.mockRejectedValue(new Error('socket hang up'))

    await expect(
      service.update({ ...base, commentId: '77', asAuthor: false }),
    ).rejects.toThrow('socket hang up')
  })

  it.each([true, false])(
    'erro no corpo que não é recusa nem NOT_FOUND rejeita (autor: %s)',
    async asAuthor => {
      const { service, authorCall, installationCall } = setup()
      authorCall.mockResolvedValue({ error: 'INTERNAL_SERVER_ERROR' })
      installationCall.mockResolvedValue({ error: 'INTERNAL_SERVER_ERROR' })

      await expect(
        service.update({
          ...base,
          commentId: '77',
          asAuthor,
          authorBitrixUserId: '7',
        }),
      ).rejects.toThrow('INTERNAL_SERVER_ERROR')
    },
  )
})

describe('ícone da marca', () => {
  const icon = 'https://app.exemplo.com/images/thinkzap/timeline-icon.png'

  it('abre o comentário com o ícone na linha do título', async () => {
    const call = vi.fn<CallMethod>().mockResolvedValue({})
    const service = new BitrixLivefeedNotificationService(
      { callMethod: call } as unknown as BitrixClient,
      undefined,
      icon,
    )

    await service.execute({ ...base, message: '[B]Mensagem enviada[/B]' })

    expect(call).toHaveBeenCalledWith('crm.timeline.comment.add', {
      fields: containing({
        COMMENT: `[IMG WIDTH=16 HEIGHT=16]${icon}[/IMG] [B]Mensagem enviada[/B]`,
      }),
    })
  })

  it('sem URL configurada, o comentário sai sem ícone', async () => {
    const { service, installationCall } = setup()

    await service.execute(base)

    expect(installationCall).toHaveBeenCalledWith(
      'crm.timeline.comment.add',
      commentCall,
    )
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
