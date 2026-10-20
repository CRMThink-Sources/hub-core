import { beforeEach, describe, expect, it, vi } from 'vitest'

const { smsSender } = vi.hoisted(() => ({
  smsSender: {
    codePrefix: 'thinkzap_sms',
    handlerUrl: 'https://api.test/api/thinkzap/webhooks/bitrix/sms-provider',
  },
}))

vi.mock('@/config/env', () => ({ env: { bitrix: { smsSender } } }))

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { LineBlockedError } from '@/modules/thinkzap/domain/errors/line-blocked.error'
import { LineProviderNotSupportedError } from '@/modules/thinkzap/domain/errors/line-provider-not-supported.error'
import { TemplateNotInCatalogError } from '@/modules/thinkzap/domain/errors/template-not-in-catalog.error'
import {
  DeleteLineSmsProvider,
  DeleteTemplateSmsProvider,
  GetLineSmsProvider,
  GetLineTemplateProviders,
  RegisterLineSmsProvider,
  RegisterTemplateSmsProvider,
} from './manage-line-sms-provider'

const item = (
  metadata: SubscriptionItem['metadata'] = {
    provider: 'ZAPI',
    zApiInstanceId: 'Z-1',
    zApiInstanceToken: 'TOKEN',
  },
): SubscriptionItem => ({
  id: '4821',
  name: 'Comercial',
  subscription: 'sub-1',
  status: 'active',
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: null,
  metadata,
})

const context = (
  line: SubscriptionItem,
  status: 'active' | 'trial_expired' = 'active',
) => ({
  execute: vi.fn().mockResolvedValue({
    subscriptions: [{ status, items: [line] }],
  }),
})

const scope = {
  subscriptionItemId: '4821',
  domainId: 'domain-1',
  appCode: 'crmthink.thinkzap',
}

const caller = (callMethod = vi.fn().mockResolvedValue([])) => ({ callMethod })

beforeEach(() => {
  vi.clearAllMocks()
  smsSender.handlerUrl =
    'https://api.test/api/thinkzap/webhooks/bitrix/sms-provider'
})

describe('GetLineSmsProvider', () => {
  it('reporta registrada quando o CODE da linha está na listagem', async () => {
    const client = caller(vi.fn().mockResolvedValue(['thinkzap_sms_4821']))

    const reading = await new GetLineSmsProvider(
      context(item()) as never,
    ).execute(scope, client)

    expect(reading).toEqual({
      registered: true,
      code: 'thinkzap_sms_4821',
      available: true,
      banRisk: true,
      perTemplate: false,
    })
  })

  it('reporta não registrada quando a listagem não traz o CODE', async () => {
    const reading = await new GetLineSmsProvider(
      context(item()) as never,
    ).execute(scope, caller())

    expect(reading.registered).toBe(false)
  })

  it('linha oficial não tem risco de ban e é por template', async () => {
    const reading = await new GetLineSmsProvider(
      context(
        item({ provider: 'HUBMESSAGE', hubmessageChannelId: 'C-9' }),
      ) as never,
    ).execute(scope, caller())

    expect(reading).toMatchObject({ banRisk: false, perTemplate: true })
  })

  it('sem handler configurado devolve indisponível sem consultar o Bitrix', async () => {
    smsSender.handlerUrl = ''
    const client = caller()

    const reading = await new GetLineSmsProvider(
      context(item()) as never,
    ).execute(scope, client)

    expect(reading).toMatchObject({ available: false, registered: false })
    expect(client.callMethod).not.toHaveBeenCalled()
  })

  it('lê linha bloqueada sem recusar — a aba precisa mostrar o estado', async () => {
    const reading = await new GetLineSmsProvider(
      context(item(), 'trial_expired') as never,
    ).execute(scope, caller())

    expect(reading.registered).toBe(false)
  })
})

describe('RegisterLineSmsProvider', () => {
  it('registra o provedor da linha', async () => {
    const client = caller(vi.fn().mockResolvedValue({}))

    const output = await new RegisterLineSmsProvider(
      context(item()) as never,
    ).execute(scope, client)

    expect(output).toEqual({ result: 'created' })
    expect(client.callMethod).toHaveBeenCalledWith(
      'messageservice.sender.add',
      expect.objectContaining({ CODE: 'thinkzap_sms_4821' }),
    )
  })

  it('recusa linha bloqueada sem chamar o Bitrix', async () => {
    const client = caller()

    await expect(
      new RegisterLineSmsProvider(
        context(item(), 'trial_expired') as never,
      ).execute(scope, client),
    ).rejects.toBeInstanceOf(LineBlockedError)
    expect(client.callMethod).not.toHaveBeenCalled()
  })

  it('recusa item que não é linha', async () => {
    await expect(
      new RegisterLineSmsProvider(
        context(item({ provider: 'NONE' })) as never,
      ).execute(scope, caller()),
    ).rejects.toBeInstanceOf(LineProviderNotSupportedError)
  })
})

describe('provedor por template', () => {
  const HUB = item({ provider: 'HUBMESSAGE', hubmessageChannelId: 'C-9' })

  const catalog = (
    templates: {
      name: string
      language: string
      body: string
      buttons?: { dynamic: boolean }[]
      header?: { type: string }
    }[] = [
      { name: 'boas_vindas', language: 'pt_BR', body: 'Olá {{1}}, dia {{2}}.' },
      { name: 'aviso', language: 'pt_BR', body: 'Aviso sem variável.' },
    ],
  ) => ({ execute: vi.fn().mockResolvedValue(templates) })

  it('cruza catálogo e senders registrados', async () => {
    const client = caller(
      vi.fn().mockResolvedValue(['thinkzap_sms.4821.boas_vindas.pt_BR']),
    )

    const reading = await new GetLineTemplateProviders(
      context(HUB) as never,
      catalog(),
    ).execute(scope, client)

    expect(reading.available).toBe(true)
    expect(reading.templates).toEqual([
      expect.objectContaining({
        templateName: 'boas_vindas',
        parameterCount: 2,
        registered: true,
        code: 'thinkzap_sms.4821.boas_vindas.pt_BR',
      }),
      expect.objectContaining({
        templateName: 'aviso',
        parameterCount: 0,
        registered: false,
      }),
    ])
  })

  it('marca o template com botão dinâmico, que a campanha não consegue enviar', async () => {
    const reading = await new GetLineTemplateProviders(
      context(HUB) as never,
      catalog([
        {
          name: 'rastreio',
          language: 'pt_BR',
          body: 'Pedido {{1}}',
          buttons: [{ dynamic: false }, { dynamic: true }],
        },
        {
          name: 'pesquisa',
          language: 'pt_BR',
          body: 'Gostou?',
          buttons: [{ dynamic: false }],
        },
      ]),
    ).execute(scope, caller(vi.fn().mockResolvedValue([])))

    expect(reading.templates.map(t => t.hasDynamicButton)).toEqual([
      true,
      false,
    ])
  })

  it('marca o template com imagem no cabeçalho, que a campanha não consegue enviar', async () => {
    const reading = await new GetLineTemplateProviders(
      context(HUB) as never,
      catalog([
        {
          name: 'promo',
          language: 'pt_BR',
          body: 'Oferta {{1}}',
          header: { type: 'IMAGE' },
        },
        {
          name: 'aviso',
          language: 'pt_BR',
          body: 'Aviso',
          header: { type: 'TEXT' },
        },
        { name: 'antigo', language: 'pt_BR', body: 'Sem header informado' },
      ]),
    ).execute(scope, caller(vi.fn().mockResolvedValue([])))

    expect(reading.templates.map(t => t.hasImageHeader)).toEqual([
      true,
      false,
      false,
    ])
  })

  it('recusa a listagem em linha que não é oficial', async () => {
    await expect(
      new GetLineTemplateProviders(context(item()) as never, catalog()).execute(
        scope,
        caller(),
      ),
    ).rejects.toBeInstanceOf(LineProviderNotSupportedError)
  })

  it('sem handler não consulta senders, mas ainda lista o catálogo', async () => {
    smsSender.handlerUrl = ''
    const client = caller()

    const reading = await new GetLineTemplateProviders(
      context(HUB) as never,
      catalog(),
    ).execute(scope, client)

    expect(reading.available).toBe(false)
    expect(reading.templates).toHaveLength(2)
    expect(client.callMethod).not.toHaveBeenCalled()
  })

  it('registra o sender do template com o CODE derivado', async () => {
    const client = caller(vi.fn().mockResolvedValue({}))

    const output = await new RegisterTemplateSmsProvider(
      context(HUB) as never,
      catalog(),
    ).execute(scope, { templateName: 'boas_vindas', language: 'pt_BR' }, client)

    expect(output).toEqual({ result: 'created' })
    expect(client.callMethod).toHaveBeenCalledWith(
      'messageservice.sender.add',
      expect.objectContaining({
        CODE: 'thinkzap_sms.4821.boas_vindas.pt_BR',
        TYPE: 'SMS',
      }),
    )
  })

  it('recusa template fora do catálogo aprovado', async () => {
    const client = caller()

    await expect(
      new RegisterTemplateSmsProvider(context(HUB) as never, catalog()).execute(
        scope,
        { templateName: 'inexistente', language: 'pt_BR' },
        client,
      ),
    ).rejects.toBeInstanceOf(TemplateNotInCatalogError)
    expect(client.callMethod).not.toHaveBeenCalled()
  })

  it('recusa registro em linha bloqueada', async () => {
    await expect(
      new RegisterTemplateSmsProvider(
        context(HUB, 'trial_expired') as never,
        catalog(),
      ).execute(
        scope,
        { templateName: 'boas_vindas', language: 'pt_BR' },
        caller(),
      ),
    ).rejects.toBeInstanceOf(LineBlockedError)
  })

  it('remove pelo CODE sem exigir que o template ainda exista', async () => {
    const client = caller(vi.fn().mockResolvedValue({}))

    const output = await new DeleteTemplateSmsProvider(
      context(HUB) as never,
    ).execute(
      scope,
      { templateName: 'reprovado_depois', language: 'pt_BR' },
      client,
    )

    expect(output).toEqual({ result: 'deleted' })
    expect(client.callMethod).toHaveBeenCalledWith(
      'messageservice.sender.delete',
      { CODE: 'thinkzap_sms.4821.reprovado_depois.pt_BR' },
    )
  })
})

describe('DeleteLineSmsProvider', () => {
  it('remove o provedor da linha', async () => {
    const client = caller(vi.fn().mockResolvedValue({}))

    const output = await new DeleteLineSmsProvider(
      context(item()) as never,
    ).execute(scope, client)

    expect(output).toEqual({ result: 'deleted' })
    expect(client.callMethod).toHaveBeenCalledWith(
      'messageservice.sender.delete',
      { CODE: 'thinkzap_sms_4821' },
    )
  })

  it('recusa linha bloqueada', async () => {
    await expect(
      new DeleteLineSmsProvider(
        context(item(), 'trial_expired') as never,
      ).execute(scope, caller()),
    ).rejects.toBeInstanceOf(LineBlockedError)
  })
})
