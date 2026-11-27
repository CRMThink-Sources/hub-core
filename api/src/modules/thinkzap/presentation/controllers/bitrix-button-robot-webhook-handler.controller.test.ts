import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'
import type {
  OpenedSendNotice,
  OpenSendNotice,
} from '@/modules/thinkzap/application/open-send-notice'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'

const { resolveRelatedDestinationsMock } = vi.hoisted(() => ({
  resolveRelatedDestinationsMock: vi.fn(),
}))

vi.mock('@/modules/thinkzap/application/related-destinations.resolver', () => ({
  resolveRelatedDestinations: resolveRelatedDestinationsMock,
  bizprocEntityToPlacement: (entity: string) =>
    entity === 'DEAL' ? 'CRM_DEAL_DETAIL_TAB' : null,
}))

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import {
  BitrixButtonRobotWebhookHandlerController,
  parseButtonList,
} from './bitrix-button-robot-webhook-handler.controller'

const target = (
  provider: ConnectorProvider = ConnectorProvider.HUBMESSAGE,
) => ({
  item: { id: 'item_1' },
  instance: { id: 'inst_1' },
  provider,
})

const makeDeps = (
  overrides: {
    resolveTarget?: ReturnType<typeof vi.fn>
    enqueue?: ReturnType<typeof vi.fn>
    domain?: unknown
    app?: unknown
  } = {},
) => {
  const getDomain = {
    getDomain: vi
      .fn()
      .mockResolvedValue(
        'domain' in overrides ? overrides.domain : { id: 'domain_1' },
      ),
  }
  const getApp = {
    getByAppCodeAndDomainId: vi
      .fn()
      .mockResolvedValue(
        'app' in overrides
          ? overrides.app
          : { id: 'app_1', appCodeId: 'crmthink.thinkzap' },
      ),
  }

  const enqueue =
    overrides.enqueue ??
    vi
      .fn()
      .mockImplementation((_target, input: { destination: string }) =>
        Promise.resolve({ destination: input.destination, status: 'queued' }),
      )

  const enqueueButtonSend = {
    resolveTarget:
      overrides.resolveTarget ?? vi.fn().mockResolvedValue(target()),
    enqueue,
  }

  const sendNotification = { execute: vi.fn().mockResolvedValue(undefined) }
  const bitrix = {}
  const refresh = vi
    .fn<OpenedSendNotice['refresh']>()
    .mockResolvedValue(undefined)
  const openSendNotice = vi
    .fn<OpenSendNotice>()
    .mockResolvedValue({ id: 'notice_1', refresh })

  return {
    getDomain,
    getApp,
    enqueueButtonSend,
    sendNotification,
    bitrix,
    enqueue,
    openSendNotice,
    refresh,
  }
}

const makeController = (
  deps: ReturnType<typeof makeDeps>,
  expectedProvider = ConnectorProvider.HUBMESSAGE,
) =>
  new BitrixButtonRobotWebhookHandlerController(
    deps.getDomain as never,
    deps.getApp as never,
    deps.enqueueButtonSend as never,
    deps.sendNotification as never,
    deps.bitrix as never,
    expectedProvider,
    null,
    deps.openSendNotice,
  )

/**
 * Provider padrão destes fixtures é HUBMESSAGE (default de `target()` e de
 * `makeController`) — que só aceita um botão `URL`, confirmado contra a API
 * real em 2026-09-15 (ver `interactive-button-validation.ts`). Testes que
 * mudam o provider passam seu próprio `buttons`.
 */
const fullProperties = {
  connector: 'item_1',
  destination: '5511999999999',
  body: 'Como podemos ajudar?',
  header: 'Título',
  footer: 'Rodapé',
  buttons: ['URL|Site|https://x.io'],
}

const makeReq = (
  properties: Record<string, unknown>,
  documentId: string[] = ['crm', 'CCrmDocumentDeal', 'DEAL_10'],
): Request =>
  ({
    body: {
      document_id: documentId,
      properties,
      auth: { domain: 'test.bitrix24.com' },
    },
  }) as unknown as Request

const res = {} as Response

beforeEach(() => {
  resolveRelatedDestinationsMock.mockReset().mockResolvedValue({
    destinations: [],
  })
})

describe('BitrixButtonRobotWebhookHandlerController', () => {
  it('enfileira um envio para o destino manual', async () => {
    const deps = makeDeps()

    const response = await makeController(deps).perform(
      makeReq(fullProperties),
      res,
    )

    expect(response.status).toBe(200)
    expect(response.result).toEqual({ received: true, queued: 1 })
    expect(deps.enqueue).toHaveBeenCalledTimes(1)
    expect(deps.enqueue).toHaveBeenCalledWith(
      target(),
      expect.objectContaining({
        subscriptionItemId: 'item_1',
        destination: '5511999999999',
        body: 'Como podemos ajudar?',
        header: 'Título',
        footer: 'Rodapé',
        buttons: [{ id: '1', label: 'Site', type: 'URL', url: 'https://x.io' }],
        entity: 'DEAL',
        entityId: '10',
      }),
    )
  })

  it('envia para todos os contatos relacionados, deduplicados', async () => {
    resolveRelatedDestinationsMock.mockResolvedValue({
      destinations: [
        { phone: '5511111111111' },
        { phone: '5522222222222' },
        { phone: '5511111111111' },
      ],
    })
    const deps = makeDeps()

    const response = await makeController(deps).perform(
      makeReq({ ...fullProperties, sendToAllRelatedContacts: 'Y' }),
      res,
    )

    expect(response.result).toEqual({ received: true, queued: 2 })
    expect(deps.enqueue).toHaveBeenCalledTimes(2)
  })

  it('ignora o destino manual quando a alternância está ligada', async () => {
    resolveRelatedDestinationsMock.mockResolvedValue({
      destinations: [{ phone: '5533333333333' }],
    })
    const deps = makeDeps()

    await makeController(deps).perform(
      makeReq({ ...fullProperties, sendToAllRelatedContacts: 'Y' }),
      res,
    )

    expect(deps.enqueue).toHaveBeenCalledTimes(1)
    expect(deps.enqueue).toHaveBeenCalledWith(
      target(),
      expect.objectContaining({ destination: '5533333333333' }),
    )
  })

  it('recusa antes de resolver destinatários quando a linha não pode enviar', async () => {
    const deps = makeDeps({
      resolveTarget: vi
        .fn()
        .mockRejectedValue(new Error('linha bloqueada ou expirada')),
    })

    const response = await makeController(deps).perform(
      makeReq({ ...fullProperties, sendToAllRelatedContacts: 'Y' }),
      res,
    )

    expect(response.status).toBe(200)
    expect(response.result).toEqual({ received: true, queued: 0 })
    expect(resolveRelatedDestinationsMock).not.toHaveBeenCalled()
    expect(deps.enqueue).not.toHaveBeenCalled()
    expect(deps.sendNotification.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'DEAL',
        contextId: '10',
        message: expect.stringContaining(
          'não pode enviar botões',
        ) as unknown as string,
      }),
    )
  })

  it('recusa quando a linha resolvida é de outro provider', async () => {
    const deps = makeDeps({
      resolveTarget: vi.fn().mockResolvedValue(target(ConnectorProvider.ZAPI)),
    })

    const response = await makeController(
      deps,
      ConnectorProvider.HUBMESSAGE,
    ).perform(makeReq(fullProperties), res)

    expect(response.result).toEqual({ received: true, queued: 0 })
    expect(deps.enqueue).not.toHaveBeenCalled()
    expect(deps.sendNotification.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('ZAPI') as unknown as string,
      }),
    )
  })

  it('aceita botão REPLY quando o robô é o oficial (HUBMESSAGE) — quick reply, até 3', async () => {
    const deps = makeDeps()

    const response = await makeController(
      deps,
      ConnectorProvider.HUBMESSAGE,
    ).perform(makeReq({ ...fullProperties, buttons: ['REPLY|Sim|'] }), res)

    expect(response.result).toEqual({ received: true, queued: 1 })
    expect(deps.enqueue).toHaveBeenCalledWith(
      target(),
      expect.objectContaining({
        buttons: [{ id: '1', label: 'Sim', type: 'REPLY' }],
      }),
    )
  })

  it('recusa o 4º botão REPLY quando o robô é o oficial (HUBMESSAGE)', async () => {
    const deps = makeDeps()

    const response = await makeController(
      deps,
      ConnectorProvider.HUBMESSAGE,
    ).perform(
      makeReq({
        ...fullProperties,
        buttons: ['REPLY|A|', 'REPLY|B|', 'REPLY|C|', 'REPLY|D|'],
      }),
      res,
    )

    expect(response.result).toEqual({ received: true, queued: 0 })
    expect(deps.enqueue).not.toHaveBeenCalled()
  })

  /**
   * A Cloud API da Meta não tem botão de ligação em mensagem de sessão livre
   * — confirmado contra a API real em 2026-09-15, apesar de a doc da
   * HubMessage documentar o tipo `CALL` neste endpoint.
   */
  it('recusa botão CALL quando o robô é o oficial (HUBMESSAGE)', async () => {
    const deps = makeDeps()

    const response = await makeController(
      deps,
      ConnectorProvider.HUBMESSAGE,
    ).perform(
      makeReq({ ...fullProperties, buttons: ['CALL|Ligar|5511888888888'] }),
      res,
    )

    expect(response.result).toEqual({ received: true, queued: 0 })
    expect(deps.enqueue).not.toHaveBeenCalled()
  })

  /**
   * O botão de URL da Meta (`cta_url`) é de um botão só por mensagem —
   * confirmado contra a API real: dois botões juntos fizeram a Meta
   * descartar o segundo silenciosamente, sem erro.
   */
  it('recusa mais de um botão quando o robô é o oficial (HUBMESSAGE)', async () => {
    const deps = makeDeps()

    const response = await makeController(
      deps,
      ConnectorProvider.HUBMESSAGE,
    ).perform(
      makeReq({
        ...fullProperties,
        buttons: ['URL|Site|https://x.io', 'URL|Outro|https://y.io'],
      }),
      res,
    )

    expect(response.result).toEqual({ received: true, queued: 0 })
    expect(deps.enqueue).not.toHaveBeenCalled()
  })

  it('recusa mistura de REPLY com URL quando o robô é o não oficial (ZAPI)', async () => {
    const deps = makeDeps({
      resolveTarget: vi.fn().mockResolvedValue(target(ConnectorProvider.ZAPI)),
    })

    const response = await makeController(deps, ConnectorProvider.ZAPI).perform(
      makeReq({
        ...fullProperties,
        buttons: ['REPLY|Sim|', 'URL|Site|https://x.io'],
      }),
      res,
    )

    expect(response.result).toEqual({ received: true, queued: 0 })
    expect(deps.enqueue).not.toHaveBeenCalled()
  })

  it('recusa quando a configuração está sem linha, corpo ou botões', async () => {
    const deps = makeDeps()

    const response = await makeController(deps).perform(
      makeReq({ ...fullProperties, body: '' }),
      res,
    )

    expect(response.result).toEqual({ received: true, queued: 0 })
    expect(deps.enqueueButtonSend.resolveTarget).not.toHaveBeenCalled()
    expect(deps.sendNotification.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining(
          'sem linha, sem corpo ou sem nenhum botão',
        ) as unknown as string,
      }),
    )
  })

  it('recusa quando nenhum destinatário é resolvido', async () => {
    const deps = makeDeps()

    const response = await makeController(deps).perform(
      makeReq({ ...fullProperties, destination: '   ' }),
      res,
    )

    expect(response.result).toEqual({ received: true, queued: 0 })
    expect(deps.enqueue).not.toHaveBeenCalled()
    expect(deps.sendNotification.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining(
          'destino do envio está vazio',
        ) as unknown as string,
      }),
    )
  })

  it('com o envio para relacionados e lista vazia, mantém o aviso de nenhum destinatário', async () => {
    const deps = makeDeps()

    await makeController(deps).perform(
      makeReq({ ...fullProperties, sendToAllRelatedContacts: 'Y' }),
      res,
    )

    expect(deps.sendNotification.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          'Nenhum destinatário encontrado para o envio da mensagem com botões.',
      }),
    )
  })

  it('não envia por contatos relacionados fora do CRM, e não tenta comentar', async () => {
    const deps = makeDeps()

    const response = await makeController(deps).perform(
      makeReq({ ...fullProperties, sendToAllRelatedContacts: 'Y' }, [
        'lists',
        'BizprocDocument',
        '68082',
      ]),
      res,
    )

    expect(response.result).toEqual({ received: true, queued: 0 })
    expect(deps.sendNotification.execute).not.toHaveBeenCalled()
  })

  it('mantém os demais destinatários quando um falha', async () => {
    resolveRelatedDestinationsMock.mockResolvedValue({
      destinations: [
        { phone: 'telefone-invalido' },
        { phone: '5544444444444' },
      ],
    })
    const enqueue = vi
      .fn()
      .mockRejectedValueOnce(new Error('Invalid destination phone number'))
      .mockResolvedValueOnce({ destination: '5544444444444' })
    const deps = makeDeps({ enqueue })

    const response = await makeController(deps).perform(
      makeReq({ ...fullProperties, sendToAllRelatedContacts: 'Y' }),
      res,
    )

    expect(response.result).toEqual({ received: true, queued: 1 })
  })

  it('recusa quando nenhum destinatário resolvido é válido', async () => {
    const deps = makeDeps({
      enqueue: vi.fn().mockRejectedValue(new Error('Invalid destination')),
    })

    const response = await makeController(deps).perform(
      makeReq(fullProperties),
      res,
    )

    expect(response.result).toEqual({ received: true, queued: 0 })
  })

  // Mesma regra do robô de template: o Bitrix entrega `{}` quando o campo vem vazio e o
  // texto cru quando não resolve, e o operador precisa saber qual dos dois aconteceu.
  describe('destino que o Bitrix não resolveu', () => {
    const rejectingEnqueue = () =>
      vi.fn().mockRejectedValue(new Error('Invalid destination phone number'))

    const lastNotice = (deps: ReturnType<typeof makeDeps>): string => {
      const calls = deps.sendNotification.execute.mock.calls as [
        { message: string },
      ][]
      return calls[calls.length - 1]?.[0].message ?? ''
    }

    it('token literal: explica que o campo não foi resolvido e cita o valor', async () => {
      const deps = makeDeps({ enqueue: rejectingEnqueue() })

      const response = await makeController(deps).perform(
        makeReq({ ...fullProperties, destination: '{{{Contato: Celular}}}' }),
        res,
      )

      expect(response.result).toEqual({ received: true, queued: 0 })
      expect(lastNotice(deps)).toContain('não resolveu o campo')
      expect(lastNotice(deps)).toContain('{{{Contato: Celular}}}')
    })

    it('chaves vazias: explica que o campo veio vazio', async () => {
      const deps = makeDeps({ enqueue: rejectingEnqueue() })

      const response = await makeController(deps).perform(
        makeReq({ ...fullProperties, destination: '{}' }),
        res,
      )

      expect(response.result).toEqual({ received: true, queued: 0 })
      expect(lastNotice(deps)).toContain('destino do envio está vazio')
    })

    it('telefone mal formado continua com o aviso de nenhum destinatário válido', async () => {
      const deps = makeDeps({ enqueue: rejectingEnqueue() })

      await makeController(deps).perform(
        makeReq({ ...fullProperties, destination: '1234' }),
        res,
      )

      expect(lastNotice(deps)).toBe(
        'Nenhum destinatário válido para o envio da mensagem com botões.',
      )
    })

    it('com um destinatário válido e outro vazio, enfileira o válido e não acusa o destino', async () => {
      resolveRelatedDestinationsMock.mockResolvedValue({
        destinations: [{ phone: '{}' }, { phone: '5544444444444' }],
      })
      const enqueue = vi
        .fn()
        .mockRejectedValueOnce(new Error('Invalid destination phone number'))
        .mockResolvedValueOnce({ destination: '5544444444444' })
      const deps = makeDeps({ enqueue })

      const response = await makeController(deps).perform(
        makeReq({ ...fullProperties, sendToAllRelatedContacts: 'Y' }),
        res,
      )

      expect(response.result).toEqual({ received: true, queued: 1 })
      expect(deps.refresh).toHaveBeenCalledTimes(1)
      expect(deps.sendNotification.execute).not.toHaveBeenCalled()
    })

    it('segue o idioma da instalação', async () => {
      const deps = makeDeps({ enqueue: rejectingEnqueue() })
      const controller = new BitrixButtonRobotWebhookHandlerController(
        deps.getDomain as never,
        deps.getApp as never,
        deps.enqueueButtonSend as never,
        deps.sendNotification as never,
        deps.bitrix as never,
        ConnectorProvider.HUBMESSAGE,
        { byAppId: vi.fn().mockResolvedValue('es') } as never,
      )

      await controller.perform(
        makeReq({ ...fullProperties, destination: '{{{Contato: Celular}}}' }),
        res,
      )

      expect(lastNotice(deps)).toContain('Bitrix no resolvió el campo')
      expect(lastNotice(deps)).toContain('{{{Contato: Celular}}}')
    })
  })

  it('responde 404 quando o domínio não é encontrado', async () => {
    const deps = makeDeps({ domain: null })

    const response = await makeController(deps).perform(
      makeReq(fullProperties),
      res,
    )

    expect(response.status).toBe(404)
  })

  it('responde 404 quando o app não está instalado', async () => {
    const deps = makeDeps({ app: null })

    const response = await makeController(deps).perform(
      makeReq(fullProperties),
      res,
    )

    expect(response.status).toBe(404)
  })

  it('não derruba o disparo quando o agendamento do comentário falha', async () => {
    const deps = makeDeps()
    deps.refresh.mockRejectedValue(new Error('redis fora'))

    const response = await makeController(deps).perform(
      makeReq(fullProperties),
      res,
    )

    expect(response.result).toEqual({ received: true, queued: 1 })
  })

  describe('aviso de envio', () => {
    const twoRecipients = () => {
      resolveRelatedDestinationsMock.mockResolvedValue({
        destinations: [{ phone: '5511111111111' }, { phone: '5522222222222' }],
      })
      return makeReq({ ...fullProperties, sendToAllRelatedContacts: 'Y' })
    }

    it('abre um aviso só, liga os envios a ele e agenda o comentário uma vez', async () => {
      const deps = makeDeps()

      await makeController(deps).perform(twoRecipients(), res)

      expect(deps.openSendNotice).toHaveBeenCalledTimes(1)
      expect(deps.openSendNotice).toHaveBeenCalledWith({
        entity: 'DEAL',
        entityId: '10',
        domainId: 'domain_1',
        appCode: 'crmthink.thinkzap',
        operatorBitrixUserId: null,
      })
      expect(deps.enqueue).toHaveBeenCalledTimes(2)
      expect(deps.enqueue.mock.calls[0]?.[1]).toMatchObject({
        sendNoticeId: 'notice_1',
      })
      expect(deps.enqueue.mock.calls[1]?.[1]).toMatchObject({
        sendNoticeId: 'notice_1',
      })
      expect(deps.refresh).toHaveBeenCalledTimes(1)
      expect(deps.refresh.mock.invocationCallOrder[0]).toBeGreaterThan(
        deps.enqueue.mock.invocationCallOrder[1] as number,
      )
      // Nenhum comentário "enfileirado": quem comenta é o aviso.
      expect(deps.sendNotification.execute).not.toHaveBeenCalled()
    })

    it('envia mesmo quando a abertura do aviso falha', async () => {
      const deps = makeDeps()
      deps.openSendNotice.mockRejectedValue(new Error('banco fora'))

      const response = await makeController(deps).perform(twoRecipients(), res)

      expect(response.result).toEqual({ received: true, queued: 2 })
      expect(deps.enqueue.mock.calls[0]?.[1]).not.toHaveProperty('sendNoticeId')
      expect(deps.sendNotification.execute).not.toHaveBeenCalled()
    })

    it('sem aviso aberto, envia sem ligar a nenhum', async () => {
      const deps = makeDeps()
      deps.openSendNotice.mockResolvedValue(null)

      const response = await makeController(deps).perform(twoRecipients(), res)

      expect(response.result).toEqual({ received: true, queued: 2 })
      expect(deps.enqueue.mock.calls[0]?.[1]).not.toHaveProperty('sendNoticeId')
      expect(deps.refresh).not.toHaveBeenCalled()
    })

    it('nada enfileirado: não agenda o comentário do aviso e comenta a recusa', async () => {
      const deps = makeDeps({
        enqueue: vi.fn().mockRejectedValue(new Error('Invalid destination')),
      })

      await makeController(deps).perform(makeReq(fullProperties), res)

      expect(deps.refresh).not.toHaveBeenCalled()
      expect(deps.sendNotification.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          message:
            'Nenhum destinatário válido para o envio da mensagem com botões.',
        }),
      )
    })

    it('recusa antes do envio não abre aviso', async () => {
      const deps = makeDeps()

      await makeController(deps).perform(
        makeReq({ ...fullProperties, destination: '' }),
        res,
      )

      expect(deps.openSendNotice).not.toHaveBeenCalled()
    })
  })
})

describe('parseButtonList', () => {
  it('monta os botões a partir da lista, na ordem', () => {
    expect(
      parseButtonList(['URL|Site|https://x.io', 'CALL|Ligar|5511999999999']),
    ).toEqual([
      { id: '1', label: 'Site', type: 'URL', url: 'https://x.io' },
      { id: '2', label: 'Ligar', type: 'CALL', phone: '5511999999999' },
    ])
  })

  it('aceita REPLY sem terceiro campo', () => {
    expect(parseButtonList(['REPLY|Sim|'])).toEqual([
      { id: '1', label: 'Sim', type: 'REPLY' },
    ])
  })

  it('aceita o objeto indexado, na ordem dos índices', () => {
    expect(parseButtonList({ '1': 'REPLY|Não|', '0': 'REPLY|Sim|' })).toEqual([
      { id: '1', label: 'Sim', type: 'REPLY' },
      { id: '2', label: 'Não', type: 'REPLY' },
    ])
  })

  it('descarta entrada com tipo desconhecido, sem derrubar as demais', () => {
    expect(parseButtonList(['FOO|X|', 'URL|Site|https://x.io'])).toEqual([
      { id: '2', label: 'Site', type: 'URL', url: 'https://x.io' },
    ])
  })

  it('descarta entrada sem label', () => {
    expect(parseButtonList(['URL||https://x.io'])).toEqual([])
  })

  it('trata ausência como lista vazia', () => {
    expect(parseButtonList(undefined)).toEqual([])
  })
})

describe('BitrixButtonRobotWebhookHandlerController idioma da timeline', () => {
  const withLocale = (
    deps: ReturnType<typeof makeDeps>,
    locale: 'pt' | 'en' | 'es',
  ) =>
    new BitrixButtonRobotWebhookHandlerController(
      deps.getDomain as never,
      deps.getApp as never,
      deps.enqueueButtonSend as never,
      deps.sendNotification as never,
      deps.bitrix as never,
      ConnectorProvider.HUBMESSAGE,
      { byAppId: vi.fn().mockResolvedValue(locale) } as never,
    )

  const commentOf = (deps: ReturnType<typeof makeDeps>) =>
    (deps.sendNotification.execute.mock.calls[0]?.[0] as { message: string })
      .message

  it('configuração incompleta em inglês', async () => {
    const deps = makeDeps()

    await withLocale(deps, 'en').perform(
      makeReq({ ...fullProperties, body: '' }),
      res,
    )

    expect(commentOf(deps)).toBe(
      'The automation has no line, no body or no button configured. Open the robot settings and fill in all three.',
    )
  })
})
