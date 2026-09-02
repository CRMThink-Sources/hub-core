import { beforeEach, describe, expect, it, vi } from 'vitest'

const { smsSender } = vi.hoisted(() => ({
  smsSender: {
    codePrefix: 'thinkzap_sms',
    handlerUrl: 'https://api.test/api/thinkzap/webhooks/bitrix/sms-provider',
  },
}))

vi.mock('@/config/env', () => ({
  env: { bitrix: { smsSender } },
}))

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { BitrixApiError } from '@/shared/infra/clients/bitrix-api.error'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { deleteSmsSender, deleteSmsSenderByCode } from './delete-sms-sender'
import { ensureSmsSender } from './ensure-sms-sender'
import { listSmsSenders } from './list-sms-senders.service'
import { MessageServiceScopeMissingError } from './helpers/sms-sender-scope-error'

const line = (overrides: Partial<SubscriptionItem> = {}): SubscriptionItem => ({
  id: '4821',
  name: 'Comercial',
  subscription: 'sub-1',
  status: 'active',
  metadata: {
    provider: 'ZAPI',
    zApiInstanceId: 'inst-1',
    zApiInstanceToken: 'tok-1',
  },
  settings: DEFAULT_CONNECTOR_SETTINGS,
  vinculatedChannel: null,
  ...overrides,
})

const bitrixError = (code: string, description?: string) =>
  new BitrixApiError('messageservice.sender.add', code, description, code)

const caller = (callMethod = vi.fn().mockResolvedValue({})) => ({ callMethod })

beforeEach(() => {
  smsSender.handlerUrl =
    'https://api.test/api/thinkzap/webhooks/bitrix/sms-provider'
})

describe('ensureSmsSender', () => {
  it('registra o sender no primeiro registro', async () => {
    const client = caller()

    await expect(ensureSmsSender(client, { item: line() })).resolves.toBe(
      'created',
    )
    expect(client.callMethod).toHaveBeenCalledTimes(1)
    expect(client.callMethod).toHaveBeenCalledWith(
      'messageservice.sender.add',
      expect.objectContaining({ CODE: 'thinkzap_sms_4821', TYPE: 'SMS' }),
    )
  })

  it('cai em update quando o CODE já existe', async () => {
    const callMethod = vi
      .fn()
      .mockRejectedValueOnce(
        bitrixError('ERROR_SENDER_ALREADY_EXISTS', 'Sender already exists'),
      )
      .mockResolvedValueOnce({})

    await expect(
      ensureSmsSender({ callMethod }, { item: line() }),
    ).resolves.toBe('updated')
    expect(callMethod).toHaveBeenLastCalledWith(
      'messageservice.sender.update',
      expect.objectContaining({ CODE: 'thinkzap_sms_4821' }),
    )
  })

  it('manda o corpo completo no update, nunca parcial', async () => {
    const callMethod = vi
      .fn()
      .mockRejectedValueOnce(bitrixError('ERROR_ALREADY_EXISTS'))
      .mockResolvedValueOnce({})

    await ensureSmsSender({ callMethod }, { item: line() })

    const [, params] = callMethod.mock.calls[1] as [string, object]
    expect(Object.keys(params).sort()).toEqual([
      'CODE',
      'DESCRIPTION',
      'HANDLER',
      'NAME',
      'TYPE',
    ])
  })

  it('devolve skipped sem tocar no Bitrix quando o handler está vazio', async () => {
    smsSender.handlerUrl = ''
    const client = caller()

    await expect(ensureSmsSender(client, { item: line() })).resolves.toBe(
      'skipped',
    )
    expect(client.callMethod).not.toHaveBeenCalled()
  })

  it('classifica escopo ausente como erro de escopo, não da linha', async () => {
    const callMethod = vi
      .fn()
      .mockRejectedValue(
        bitrixError('insufficient_scope', 'Insufficient scope'),
      )

    await expect(
      ensureSmsSender({ callMethod }, { item: line() }),
    ).rejects.toBeInstanceOf(MessageServiceScopeMissingError)
    expect(callMethod).toHaveBeenCalledTimes(1)
  })

  it('propaga erro que não é conflito nem escopo', async () => {
    const callMethod = vi
      .fn()
      .mockRejectedValue(bitrixError('ERROR_UNEXPECTED'))

    await expect(
      ensureSmsSender({ callMethod }, { item: line() }),
    ).rejects.toThrow('ERROR_UNEXPECTED')
  })
})

describe('deleteSmsSender', () => {
  it('remove pelo CODE derivado do item', async () => {
    const client = caller()

    await expect(deleteSmsSender(client, '4821')).resolves.toBe('deleted')
    expect(client.callMethod).toHaveBeenCalledWith(
      'messageservice.sender.delete',
      { CODE: 'thinkzap_sms_4821' },
    )
  })

  it('devolve skipped quando o sender não existe', async () => {
    const callMethod = vi
      .fn()
      .mockRejectedValue(bitrixError('ERROR_SENDER_NOT_FOUND', 'Not found'))

    await expect(deleteSmsSender({ callMethod }, '4821')).resolves.toBe(
      'skipped',
    )
  })

  it('remove sender órfão pelo CODE cru', async () => {
    const client = caller()

    await expect(
      deleteSmsSenderByCode(client, 'thinkzap_sms_999'),
    ).resolves.toBe('deleted')
  })

  it('classifica escopo ausente na remoção', async () => {
    const callMethod = vi
      .fn()
      .mockRejectedValue(bitrixError('insufficient_scope'))

    await expect(
      deleteSmsSender({ callMethod }, '4821'),
    ).rejects.toBeInstanceOf(MessageServiceScopeMissingError)
  })
})

describe('listSmsSenders', () => {
  const senders = [
    { CODE: 'thinkzap_sms_4821', NAME: 'ThinkZap WhatsApp — Comercial' },
    { CODE: 'thinkzap_sms_999', NAME: 'ThinkZap WhatsApp — Antiga' },
    { CODE: 'outro_app_1', NAME: 'Outro provedor' },
  ]

  it('marca o sender que casa com uma linha e o que não casa', async () => {
    const callMethod = vi.fn().mockResolvedValue(senders)

    const result = await listSmsSenders({ callMethod }, [
      { id: '4821', name: 'Comercial' },
    ])

    expect(result).toEqual([
      {
        code: 'thinkzap_sms_4821',
        name: 'ThinkZap WhatsApp — Comercial',
        subscriptionItemId: '4821',
        lineName: 'Comercial',
        orphan: false,
        templateName: null,
        language: null,
      },
      {
        code: 'thinkzap_sms_999',
        name: 'ThinkZap WhatsApp — Antiga',
        subscriptionItemId: '999',
        lineName: null,
        orphan: true,
        templateName: null,
        language: null,
      },
    ])
  })

  it('não lista sender de outro aplicativo', async () => {
    const callMethod = vi.fn().mockResolvedValue(senders)

    const result = await listSmsSenders({ callMethod }, [])

    expect(result.map(sender => sender.code)).not.toContain('outro_app_1')
  })

  it('lê a lista de CODEs crus, como bizproc.robot.list devolve', async () => {
    const callMethod = vi
      .fn()
      .mockResolvedValue(['thinkzap_sms_4821', 'outro_app_1'])

    const result = await listSmsSenders({ callMethod }, [
      { id: '4821', name: 'Comercial' },
    ])

    expect(result).toEqual([
      {
        code: 'thinkzap_sms_4821',
        name: null,
        subscriptionItemId: '4821',
        lineName: 'Comercial',
        orphan: false,
        templateName: null,
        language: null,
      },
    ])
  })

  it('reconhece sender de template e devolve template e idioma', async () => {
    const callMethod = vi
      .fn()
      .mockResolvedValue(['thinkzap_sms.4821.boas_vindas.pt_BR'])

    const result = await listSmsSenders({ callMethod }, [
      { id: '4821', name: 'Comercial' },
    ])

    expect(result).toEqual([
      expect.objectContaining({
        code: 'thinkzap_sms.4821.boas_vindas.pt_BR',
        subscriptionItemId: '4821',
        templateName: 'boas_vindas',
        language: 'pt_BR',
        orphan: false,
      }),
    ])
  })

  it('marca órfão a partir de CODE cru', async () => {
    const callMethod = vi.fn().mockResolvedValue(['thinkzap_sms_9999'])

    const result = await listSmsSenders({ callMethod }, [
      { id: '4821', name: 'Comercial' },
    ])

    expect(result).toEqual([
      expect.objectContaining({ code: 'thinkzap_sms_9999', orphan: true }),
    ])
  })

  it('lê o sender quando o código vem em ID em vez de CODE', async () => {
    const callMethod = vi
      .fn()
      .mockResolvedValue([{ ID: 'thinkzap_sms_4821', NAME: 'Comercial' }])

    const result = await listSmsSenders({ callMethod }, [
      { id: '4821', name: 'Comercial' },
    ])

    expect(result).toEqual([
      expect.objectContaining({
        code: 'thinkzap_sms_4821',
        subscriptionItemId: '4821',
        orphan: false,
      }),
    ])
  })

  it('lê a resposta agrupada por tipo', async () => {
    const callMethod = vi
      .fn()
      .mockResolvedValue({ SMS: [{ CODE: 'thinkzap_sms_4821' }] })

    const result = await listSmsSenders({ callMethod }, [
      { id: '4821', name: 'Comercial' },
    ])

    expect(result.map(sender => sender.code)).toEqual(['thinkzap_sms_4821'])
  })

  it('lê a resposta como objeto indexado', async () => {
    const callMethod = vi
      .fn()
      .mockResolvedValue({ '0': { CODE: 'thinkzap_sms_4821' } })

    const result = await listSmsSenders({ callMethod }, [
      { id: '4821', name: 'Comercial' },
    ])

    expect(result.map(sender => sender.code)).toEqual(['thinkzap_sms_4821'])
  })

  it('descarta ID numérico interno — não casa com o prefixo', async () => {
    const callMethod = vi.fn().mockResolvedValue([{ ID: '317', NAME: 'Outro' }])

    await expect(listSmsSenders({ callMethod }, [])).resolves.toEqual([])
  })

  it('classifica escopo ausente na listagem', async () => {
    const callMethod = vi
      .fn()
      .mockRejectedValue(bitrixError('ERROR_METHOD_NOT_FOUND'))

    await expect(listSmsSenders({ callMethod }, [])).rejects.toBeInstanceOf(
      MessageServiceScopeMissingError,
    )
  })
})
