import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'
import { env } from '@/config/env'

const {
  sendMessageMock,
  getPhoneDataMock,
  sendImageMock,
  sendDocumentMock,
  sendAudioMock,
  sendVideoMock,
} = vi.hoisted(() => ({
  sendMessageMock: vi.fn(),
  getPhoneDataMock: vi.fn(),
  sendImageMock: vi.fn(),
  sendDocumentMock: vi.fn(),
  sendAudioMock: vi.fn(),
  sendVideoMock: vi.fn(),
}))

vi.mock('../../infra/clients/z-api.client', () => ({
  ZApiClient: class {
    sendMessage = sendMessageMock
    getPhoneData = getPhoneDataMock
    sendImage = sendImageMock
    sendDocument = sendDocumentMock
    sendAudio = sendAudioMock
    sendVideo = sendVideoMock
  },
}))

vi.mock('@/shared/helpers/convert-to-mp3', () => ({
  convertToMp3: vi.fn().mockResolvedValue(Buffer.from('mp3')),
}))

import {
  BitrixRobotWebhookHandlerController,
  parseBizprocDocumentId,
} from './bitrix-robot-webhook-handler.controller'
import { RobotFileTooLargeError } from '../../application/robot-files/fetch-robot-files'

const crmItem = (
  id: string,
  name: string,
  phone?: string,
  extra: Record<string, unknown> = {},
) => ({
  result: {
    item: {
      id,
      name,
      fm: phone ? [{ typeId: 'PHONE', value: phone }] : [],
      ...extra,
    },
  },
})

const makeDeps = (
  overrides: {
    bitrix?: Record<string, ReturnType<typeof vi.fn>>
  } = {},
) => {
  const getDomain = { getDomain: vi.fn().mockResolvedValue({ id: 'domain-1' }) }
  const getApp = {
    getByAppCodeAndDomainId: vi
      .fn()
      .mockResolvedValue({ id: 'app-1', appCodeId: 'crmthink.thinkzap' }),
  }
  /**
   * A linha vem do item de assinatura: a opção do robô carrega o id do item, não o
   * do conector.
   */
  const getAplicationContext = {
    execute: vi.fn().mockResolvedValue({
      customer: { id: 'domain-1', name: 'test.bitrix24.com' },
      aplication: { id: 'app-1', spaId: '42' },
      subscriptions: [
        {
          id: 'sub-1',
          // `status` e janela obrigatórios: sem eles o entitlement cai em
          // `inactive` e o robô recusa antes de resolver recipients.
          status: 'active',
          currentPeriodEnd: new Date('2099-01-01T00:00:00.000Z'),
          items: [
            {
              id: 'conn',
              name: 'Linha',
              subscription: 'sub-1',
              status: 'active',
              settings: {},
              vinculatedChannel: null,
              metadata: {
                provider: 'ZAPI',
                zApiInstanceId: 'zapi-inst',
                zApiInstanceToken: 'tok',
              },
            },
          ],
        },
      ],
    }),
  }
  const sendNotification = { execute: vi.fn().mockResolvedValue(undefined) }
  const bitrix = {
    getCrmItem: vi.fn(),
    getDealContactIds: vi.fn().mockResolvedValue([]),
    getCompanyContactIds: vi.fn().mockResolvedValue([]),
    ...overrides.bitrix,
  }

  return {
    getDomain,
    getApp,
    getAplicationContext,
    sendNotification,
    bitrix,
  }
}

const makeController = (deps: ReturnType<typeof makeDeps>) =>
  new BitrixRobotWebhookHandlerController(
    deps.getDomain as never,
    deps.getApp as never,
    deps.getAplicationContext as never,
    deps.sendNotification as never,
    deps.bitrix as never,
  )

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
  sendMessageMock.mockReset().mockResolvedValue({ messageId: 'm' })
  getPhoneDataMock.mockReset().mockResolvedValue({ phone: '5599' })
  sendImageMock.mockReset().mockResolvedValue({ messageId: 'img' })
  sendDocumentMock.mockReset().mockResolvedValue({ messageId: 'doc' })
  sendAudioMock.mockReset().mockResolvedValue({ messageId: 'aud' })
  sendVideoMock.mockReset().mockResolvedValue({ messageId: 'vid' })
})

describe('BitrixRobotWebhookHandlerController', () => {
  it('toggle OFF + destination → single send (existing behavior)', async () => {
    const deps = makeDeps()
    const controller = makeController(deps)

    const result = await controller.perform(
      makeReq({ connector: 'conn', destination: '5511999', message: 'oi' }),
      res,
    )

    expect(sendMessageMock).toHaveBeenCalledTimes(1)
    expect(sendMessageMock).toHaveBeenCalledWith(
      'zapi-inst',
      'tok',
      'oi',
      '5511999',
    )
    expect(result.status).toBe(200)
  })

  it('toggle ON → sends once per unique related phone (dedup applied)', async () => {
    const deps = makeDeps({
      bitrix: {
        getCrmItem: vi
          .fn()
          .mockImplementation((entityTypeId: number, id: string) => {
            if (entityTypeId === 2 && id === '10')
              return Promise.resolve(crmItem('10', 'Deal'))
            if (entityTypeId === 3 && id === '100')
              return Promise.resolve(crmItem('100', 'A', '551100'))
            if (entityTypeId === 3 && id === '101')
              return Promise.resolve(crmItem('101', 'B', '551100')) // dup phone
            if (entityTypeId === 3 && id === '102')
              return Promise.resolve(crmItem('102', 'C', '552200'))
            return Promise.reject(new Error('unexpected'))
          }),
        getDealContactIds: vi.fn().mockResolvedValue(['100', '101', '102']),
      },
    })
    const controller = makeController(deps)

    await controller.perform(
      makeReq({
        connector: 'conn',
        sendToAllRelatedContacts: 'Y',
        message: 'oi',
      }),
      res,
    )

    expect(sendMessageMock).toHaveBeenCalledTimes(2)
    const sentPhones = sendMessageMock.mock.calls
      .map(c => c[3] as string)
      .sort()
    expect(sentPhones).toEqual(['551100', '552200'])
  })

  it('toggle ON ignores manual destination', async () => {
    const deps = makeDeps({
      bitrix: {
        getCrmItem: vi
          .fn()
          .mockImplementation((entityTypeId: number, id: string) => {
            if (entityTypeId === 2 && id === '10')
              return Promise.resolve(crmItem('10', 'Deal'))
            if (entityTypeId === 3 && id === '100')
              return Promise.resolve(crmItem('100', 'A', '551100'))
            return Promise.reject(new Error('unexpected'))
          }),
        getDealContactIds: vi.fn().mockResolvedValue(['100']),
      },
    })
    const controller = makeController(deps)

    await controller.perform(
      makeReq({
        connector: 'conn',
        destination: '5500MANUAL',
        sendToAllRelatedContacts: 'Y',
        message: 'oi',
      }),
      res,
    )

    const sentPhones = sendMessageMock.mock.calls.map(c => c[3] as string)
    expect(sentPhones).toEqual(['551100'])
    expect(sentPhones).not.toContain('5500MANUAL')
  })

  it('one recipient send fails → others still sent, failure isolated', async () => {
    const deps = makeDeps({
      bitrix: {
        getCrmItem: vi
          .fn()
          .mockImplementation((entityTypeId: number, id: string) => {
            if (entityTypeId === 2 && id === '10')
              return Promise.resolve(crmItem('10', 'Deal'))
            if (entityTypeId === 3 && id === '100')
              return Promise.resolve(crmItem('100', 'A', '551100'))
            if (entityTypeId === 3 && id === '101')
              return Promise.resolve(crmItem('101', 'B', '552200'))
            return Promise.reject(new Error('unexpected'))
          }),
        getDealContactIds: vi.fn().mockResolvedValue(['100', '101']),
      },
    })
    sendMessageMock.mockReset()
    sendMessageMock.mockRejectedValueOnce(new Error('boom'))
    sendMessageMock.mockResolvedValue({ messageId: 'm' })

    const controller = makeController(deps)
    const result = await controller.perform(
      makeReq({
        connector: 'conn',
        sendToAllRelatedContacts: 'Y',
        message: 'oi',
      }),
      res,
    )

    expect(sendMessageMock).toHaveBeenCalledTimes(2)
    expect(result.status).toBe(200)
    expect((result.result as { sent: number }).sent).toBe(1)
  })

  it('smart process item → notification targets the DYNAMIC_<typeId> owner', async () => {
    const deps = makeDeps()
    const controller = makeController(deps)

    const result = await controller.perform(
      makeReq({ connector: 'conn', destination: '5511999', message: 'oi' }, [
        'crm',
        'Bitrix\\Crm\\Integration\\BizProc\\Document\\Dynamic',
        'DYNAMIC_183_9',
      ]),
      res,
    )

    expect(result.status).toBe(200)
    expect(deps.sendNotification.execute).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'DYNAMIC_183', contextId: '9' }),
    )
  })

  it('universal list workflow → still sends, no timeline comment', async () => {
    const deps = makeDeps()
    const controller = makeController(deps)

    const result = await controller.perform(
      makeReq({ connector: 'conn', destination: '5511999', message: 'oi' }, [
        'lists',
        'BizprocDocument',
        '68082',
      ]),
      res,
    )

    expect(sendMessageMock).toHaveBeenCalledTimes(1)
    expect(sendMessageMock).toHaveBeenCalledWith(
      'zapi-inst',
      'tok',
      'oi',
      '5511999',
    )
    expect(deps.sendNotification.execute).not.toHaveBeenCalled()
    expect(result.status).toBe(200)
  })

  it('universal list workflow with toggle ON → no recipients, no comment, no throw', async () => {
    const deps = makeDeps()
    const controller = makeController(deps)

    const result = await controller.perform(
      makeReq(
        { connector: 'conn', sendToAllRelatedContacts: 'Y', message: 'oi' },
        ['lists', 'BizprocDocument', '68082'],
      ),
      res,
    )

    expect(sendMessageMock).not.toHaveBeenCalled()
    expect(deps.sendNotification.execute).not.toHaveBeenCalled()
    expect(result.status).toBe(200)
    expect((result.result as { sent: number }).sent).toBe(0)
  })

  it('unknown entity / no phones → no send, no throw, notification recorded', async () => {
    const deps = makeDeps({
      bitrix: {
        getCrmItem: vi.fn().mockResolvedValue(crmItem('10', 'Deal')),
        getDealContactIds: vi.fn().mockResolvedValue([]),
      },
    })
    const controller = makeController(deps)

    const result = await controller.perform(
      makeReq({
        connector: 'conn',
        sendToAllRelatedContacts: 'Y',
        message: 'oi',
      }),
      res,
    )

    expect(sendMessageMock).not.toHaveBeenCalled()
    expect(result.status).toBe(200)
    expect(deps.sendNotification.execute).toHaveBeenCalledTimes(1)
  })
})

describe('parseBizprocDocumentId', () => {
  it('parses standard CRM entities', () => {
    expect(parseBizprocDocumentId('DEAL_10')).toEqual({
      entity: 'DEAL',
      entityId: '10',
    })
  })

  it('keeps the full DYNAMIC_<typeId> owner type for smart process items', () => {
    expect(parseBizprocDocumentId('DYNAMIC_183_9')).toEqual({
      entity: 'DYNAMIC_183',
      entityId: '9',
    })
  })

  it('keeps multi-word owner types intact', () => {
    expect(parseBizprocDocumentId('SMART_INVOICE_5')).toEqual({
      entity: 'SMART_INVOICE',
      entityId: '5',
    })
  })

  it('rejects tokens without an id', () => {
    expect(parseBizprocDocumentId('DEAL')).toBeNull()
    expect(parseBizprocDocumentId('_10')).toBeNull()
  })

  it('returns null for universal list documents (bare element id)', () => {
    expect(parseBizprocDocumentId('68082')).toBeNull()
  })

  it('rejects non-numeric ids', () => {
    expect(parseBizprocDocumentId('DEAL_abc')).toBeNull()
  })
})

describe('BitrixRobotWebhookHandlerController limite diário', () => {
  const reserved = {
    status: 'reserved' as const,
    reservation: { release: vi.fn().mockResolvedValue(undefined) },
  }
  const refused = {
    status: 'refused' as const,
    counts: { sent: 1, extra: 0 },
    effectiveLimit: 1,
  }

  const relatedDeps = () =>
    makeDeps({
      bitrix: {
        getCrmItem: vi
          .fn()
          .mockImplementation((entityTypeId: number, id: string) => {
            if (entityTypeId === 2 && id === '10')
              return Promise.resolve(crmItem('10', 'Deal'))
            if (entityTypeId === 3 && id === '100')
              return Promise.resolve(crmItem('100', 'A', '551100'))
            if (entityTypeId === 3 && id === '101')
              return Promise.resolve(crmItem('101', 'B', '552200'))
            return Promise.reject(new Error('unexpected'))
          }),
        getDealContactIds: vi.fn().mockResolvedValue(['100', '101']),
      },
    })

  it('destinatários depois do limite não recebem e aparecem na timeline', async () => {
    const deps = relatedDeps()
    const reserve = vi
      .fn()
      .mockResolvedValueOnce(reserved)
      .mockResolvedValueOnce(refused)
    const controller = new BitrixRobotWebhookHandlerController(
      deps.getDomain as never,
      deps.getApp as never,
      deps.getAplicationContext as never,
      deps.sendNotification as never,
      deps.bitrix as never,
      { reserve } as never,
    )

    const response = await controller.perform(
      makeReq({
        connector: 'conn',
        sendToAllRelatedContacts: 'Y',
        message: 'oi',
      }),
      res,
    )

    expect(reserve).toHaveBeenCalledWith(
      { lineKey: 'zapi-inst', enabled: false, limit: 0 },
      expect.any(Date),
    )
    expect(sendMessageMock).toHaveBeenCalledTimes(1)
    expect(response.result).toMatchObject({
      sent: 1,
      refusedByDailyLimit: 1,
    })
    const comment = (
      deps.sendNotification.execute.mock.calls[0]?.[0] as { message: string }
    ).message
    expect(comment).toContain('NÃO enviado (limite diário da linha atingido)')
  })
})

describe('BitrixRobotWebhookHandlerController limite diário (idioma)', () => {
  it('instalação em espanhol: destinatários recusados listados em espanhol', async () => {
    const deps = makeDeps()
    const reserve = vi.fn().mockResolvedValue({
      status: 'refused',
      counts: { sent: 1, extra: 0 },
      effectiveLimit: 1,
    })
    const byAppId = vi.fn().mockResolvedValue('es')
    const controller = new BitrixRobotWebhookHandlerController(
      deps.getDomain as never,
      deps.getApp as never,
      deps.getAplicationContext as never,
      deps.sendNotification as never,
      deps.bitrix as never,
      { reserve } as never,
      { byAppId } as never,
    )

    await controller.perform(
      makeReq({ connector: 'conn', destination: '5511', message: 'oi' }),
      res,
    )

    expect(byAppId).toHaveBeenCalledWith('app-1')
    const comment = (
      deps.sendNotification.execute.mock.calls[0]?.[0] as { message: string }
    ).message
    expect(comment).toContain(
      'NO enviado (límite diario de la línea alcanzado)',
    )
  })
})

describe('BitrixRobotWebhookHandlerController arquivos', () => {
  // Campo de arquivo do negócio como `crm.item.get` devolve; o download é falso.
  const FILES: Record<string, { name: string; type: string }> = {
    '1': { name: 'contrato.pdf', type: 'application/pdf' },
    '2': { name: 'anexo.png', type: 'image/png' },
    '3': { name: 'recado.ogg', type: 'audio/ogg' },
  }

  const fileDeps = (available = Object.keys(FILES)) => ({
    getCrmItem: vi.fn().mockResolvedValue({
      result: {
        item: {
          id: 10,
          ufCrm_Anexos: available.map(id => ({
            id: Number(id),
            urlMachine: `https://portal/file/${id}`,
          })),
        },
      },
    }),
    download: vi.fn().mockImplementation((url: string) => {
      const file = FILES[url.split('/').pop() ?? '']
      if (!file) return Promise.reject(new Error('404'))
      return Promise.resolve({
        data: Buffer.from(file.name),
        contentType: file.type,
        contentDisposition: `attachment; filename="${file.name}"`,
      })
    }),
  })

  const run = async (
    properties: Record<string, unknown>,
    options: {
      files?: ReturnType<typeof fileDeps>
      reserve?: ReturnType<typeof vi.fn>
    } = {},
  ) => {
    const deps = makeDeps()
    const files = options.files ?? fileDeps()
    const controller = new BitrixRobotWebhookHandlerController(
      deps.getDomain as never,
      deps.getApp as never,
      deps.getAplicationContext as never,
      deps.sendNotification as never,
      deps.bitrix as never,
      options.reserve ? ({ reserve: options.reserve } as never) : null,
      null,
      files,
    )
    const response = await controller.perform(
      makeReq({ connector: 'conn', destination: '5511', ...properties }),
      res,
    )
    const comment = (
      deps.sendNotification.execute.mock.calls[0]?.[0] as
        | { message: string }
        | undefined
    )?.message
    return { response, comment, files }
  }

  const dataUrl = (mime: string, name: string) =>
    `data:${mime};base64,${Buffer.from(name).toString('base64')}`

  it('robô antigo só com texto: mesmo envio e mesmo comentário de antes', async () => {
    const { comment, files } = await run({ message: 'oi' })

    expect(sendMessageMock).toHaveBeenCalledWith(
      'zapi-inst',
      'tok',
      'oi',
      '5511',
    )
    expect(files.getCrmItem).not.toHaveBeenCalled()
    expect(comment).toBe('De: 5599\nPara: 5511\nMensagem: oi')
  })

  it('arquivo do campo do negócio sai como documento, com o nome', async () => {
    const { files } = await run({ message: '', file: ['1'] })

    expect(files.getCrmItem).toHaveBeenCalledWith(2, '10')
    expect(sendMessageMock).not.toHaveBeenCalled()
    expect(sendDocumentMock).toHaveBeenCalledWith(
      'zapi-inst',
      'tok',
      dataUrl('application/pdf', 'contrato.pdf'),
      '5511',
      'contrato.pdf',
      { caption: undefined },
    )
  })

  it('texto e PDF saem numa mensagem só, com legenda', async () => {
    const { comment } = await run({
      message: 'Segue sua proposta',
      file: ['1'],
    })

    expect(sendMessageMock).not.toHaveBeenCalled()
    expect(sendDocumentMock).toHaveBeenCalledTimes(1)
    expect(sendDocumentMock.mock.calls[0]?.[5]).toEqual({
      caption: 'Segue sua proposta',
    })
    expect(comment).toBe(
      'De: 5599\nPara: 5511\nMensagem: Segue sua proposta\n' +
        'Arquivos enviados: contrato.pdf',
    )
  })

  it('texto e áudio: texto primeiro, depois a voz', async () => {
    await run({ message: 'Ouça o recado', file: ['3'] })

    expect(sendMessageMock).toHaveBeenCalledWith(
      'zapi-inst',
      'tok',
      'Ouça o recado',
      '5511',
    )
    expect(sendAudioMock).toHaveBeenCalledTimes(1)
    expect(sendMessageMock.mock.invocationCallOrder[0]).toBeLessThan(
      sendAudioMock.mock.invocationCallOrder[0]!,
    )
  })

  it('vários arquivos: legenda só no primeiro, na ordem', async () => {
    await run({ message: 'Documentos do contrato', file: ['1', '2'] })

    expect(sendDocumentMock.mock.calls[0]?.[5]).toEqual({
      caption: 'Documentos do contrato',
    })
    expect(sendImageMock).toHaveBeenCalledWith(
      'zapi-inst',
      'tok',
      dataUrl('image/png', 'anexo.png'),
      '5511',
      { caption: undefined },
    )
    expect(sendDocumentMock.mock.invocationCallOrder[0]).toBeLessThan(
      sendImageMock.mock.invocationCallOrder[0]!,
    )
  })

  it('arquivo baixado uma vez só, com vários destinatários', async () => {
    const deps = makeDeps({
      bitrix: {
        getCrmItem: vi
          .fn()
          .mockImplementation((entityTypeId: number, id: string) => {
            if (entityTypeId === 2 && id === '10')
              return Promise.resolve(crmItem('10', 'Deal'))
            if (entityTypeId === 3)
              return Promise.resolve(crmItem(id, 'C', `55${id}`))
            return Promise.reject(new Error('unexpected'))
          }),
        getDealContactIds: vi.fn().mockResolvedValue(['100', '101']),
      },
    })
    const files = fileDeps()
    const controller = new BitrixRobotWebhookHandlerController(
      deps.getDomain as never,
      deps.getApp as never,
      deps.getAplicationContext as never,
      deps.sendNotification as never,
      deps.bitrix as never,
      null,
      null,
      files,
    )

    await controller.perform(
      makeReq({
        connector: 'conn',
        sendToAllRelatedContacts: 'Y',
        message: 'oi',
        file: ['1'],
      }),
      res,
    )

    expect(files.download).toHaveBeenCalledTimes(1)
    expect(sendDocumentMock).toHaveBeenCalledTimes(2)
  })

  it('arquivo fora do documento (enviado na configuração): só o texto sai', async () => {
    const { comment } = await run({
      message: 'Segue o boleto',
      file: ['999'],
    })

    expect(sendMessageMock).toHaveBeenCalledWith(
      'zapi-inst',
      'tok',
      'Segue o boleto',
      '5511',
    )
    expect(sendDocumentMock).not.toHaveBeenCalled()
    expect(comment).toContain(
      'Arquivos não enviados: #999 (não foi possível obter o arquivo)',
    )
  })

  it('um arquivo indisponível não impede o outro', async () => {
    const { comment } = await run({
      message: '',
      file: ['1', '5'],
      files: fileDeps(['1', '5']),
    })

    expect(sendDocumentMock).toHaveBeenCalledTimes(1)
    expect(comment).toContain('Arquivos enviados: contrato.pdf')
    expect(comment).toContain('#5 (não foi possível obter o arquivo)')
  })

  it('arquivo grande demais: o texto sai sozinho', async () => {
    const files = fileDeps(['4'])
    files.download.mockRejectedValue(new RobotFileTooLargeError())

    const { comment } = await run(
      { message: 'Segue o vídeo', file: ['4'] },
      { files },
    )

    expect(sendMessageMock).toHaveBeenCalledWith(
      'zapi-inst',
      'tok',
      'Segue o vídeo',
      '5511',
    )
    expect(comment).toContain('#4 (maior que 30 MB)')
  })

  it('sem mensagem e sem arquivo: nada sai e a timeline avisa', async () => {
    const { response, comment, files } = await run({ message: '  ' })

    expect(sendMessageMock).not.toHaveBeenCalled()
    expect(files.getCrmItem).not.toHaveBeenCalled()
    expect(response.result).toMatchObject({ sent: 0 })
    expect(comment).toBe(
      'A automação não tem mensagem nem arquivo para enviar. Abra a configuração do robô e preencha a mensagem ou o arquivo.',
    )
  })

  it('erro do provider num arquivo: os demais seguem e ele aparece como falha', async () => {
    sendDocumentMock.mockRejectedValueOnce(new Error('zapi 500'))

    const { comment } = await run({ message: '', file: ['1', '2'] })

    expect(sendImageMock).toHaveBeenCalledTimes(1)
    expect(comment).toContain('Arquivos enviados: anexo.png')
    expect(comment).toContain('contrato.pdf (falha no envio)')
  })

  describe('limite diário', () => {
    const reserved = {
      status: 'reserved' as const,
      reservation: { release: vi.fn().mockResolvedValue(undefined) },
    }
    const refused = {
      status: 'refused' as const,
      counts: { sent: 1, extra: 0 },
      effectiveLimit: 1,
    }

    it('legenda não conta à parte: duas partes, duas vagas', async () => {
      const reserve = vi.fn().mockResolvedValue(reserved)

      await run({ message: 'Documentos', file: ['1', '2'] }, { reserve })

      expect(reserve).toHaveBeenCalledTimes(2)
    })

    it('limite atingido no meio: o resto não sai e o destinatário é listado', async () => {
      const reserve = vi
        .fn()
        .mockResolvedValueOnce(reserved)
        .mockResolvedValueOnce(refused)

      const { response, comment } = await run(
        { message: '', file: ['1', '2'] },
        { reserve },
      )

      expect(sendDocumentMock).toHaveBeenCalledTimes(1)
      expect(sendImageMock).not.toHaveBeenCalled()
      expect(response.result).toMatchObject({
        sent: 0,
        refusedByDailyLimit: 1,
      })
      expect(comment).toContain('Arquivos enviados: contrato.pdf')
      expect(comment).not.toContain('anexo.png')
      expect(comment).toContain('NÃO enviado (limite diário da linha atingido)')
    })
  })
})

describe('BitrixRobotWebhookHandlerController idioma da timeline', () => {
  it('sem destinatário em inglês', async () => {
    const deps = makeDeps()
    const controller = new BitrixRobotWebhookHandlerController(
      deps.getDomain as never,
      deps.getApp as never,
      deps.getAplicationContext as never,
      deps.sendNotification as never,
      deps.bitrix as never,
      null,
      { byAppId: vi.fn().mockResolvedValue('en') } as never,
    )

    await controller.perform(makeReq({ connector: 'conn', message: 'oi' }), res)

    const comment = (
      deps.sendNotification.execute.mock.calls[0]?.[0] as { message: string }
    ).message
    expect(comment).toBe('From: 5599\nNo recipients found for this send.')
  })
})

describe('BitrixRobotWebhookHandlerController — caminho unificado (fila)', () => {
  const setFlag = (value: string) => {
    ;(
      env as { thinkzapUnifiedOutboxDomains: string }
    ).thinkzapUnifiedOutboxDomains = value
  }
  afterEach(() => setFlag(''))

  function queuedController(deps: ReturnType<typeof makeDeps>) {
    const queued = { execute: vi.fn().mockResolvedValue({ queued: 1 }) }
    const controller = new BitrixRobotWebhookHandlerController(
      deps.getDomain as never,
      deps.getApp as never,
      deps.getAplicationContext as never,
      deps.sendNotification as never,
      deps.bitrix as never,
      null,
      null,
      null,
      queued as never,
    )
    return { controller, queued }
  }

  it('com a flag: enfileira o disparo, não envia nem comenta na hora', async () => {
    setFlag('*')
    const deps = makeDeps()
    const { controller, queued } = queuedController(deps)

    const result = await controller.perform(
      makeReq({ connector: 'conn', destination: '5511999', message: 'oi' }),
      res,
    )

    expect(sendMessageMock).not.toHaveBeenCalled()
    expect(deps.sendNotification.execute).not.toHaveBeenCalled()
    expect(queued.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'oi',
        recipients: ['5511999'],
        fromPhone: '5599',
        crmDocument: { entity: 'DEAL', entityId: '10' },
      }),
    )
    expect(result).toMatchObject({
      status: 200,
      result: { received: true, queued: 1 },
    })
  })

  it('sem a flag: segue o envio síncrono mesmo com a fila montada', async () => {
    const deps = makeDeps()
    const { controller, queued } = queuedController(deps)

    await controller.perform(
      makeReq({ connector: 'conn', destination: '5511999', message: 'oi' }),
      res,
    )

    expect(queued.execute).not.toHaveBeenCalled()
    expect(sendMessageMock).toHaveBeenCalledTimes(1)
  })
})
