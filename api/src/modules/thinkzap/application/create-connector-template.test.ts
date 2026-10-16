import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
/* eslint-disable @typescript-eslint/unbound-method */
import { describe, expect, it, vi } from 'vitest'
import { ConnectorNotTemplateCapableError } from '@/modules/thinkzap/domain/ports/template-errors'
import { TemplateProviderResolver } from '@/modules/thinkzap/domain/ports/template-provider-resolver.port'
import { WhatsAppTemplateProvider } from '@/modules/thinkzap/domain/ports/whatsapp-template-provider.port'
import { LineNotFoundError } from '@/modules/thinkzap/domain/errors/line-not-found.error'
import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import {
  CreateConnectorTemplateUseCase,
  InvalidTemplateError,
} from './create-connector-template'

/** `wabaId` vem do item da SPA — nem `Connector` nem `Instance` participam. */
const hubItem: SubscriptionItem = {
  id: 'item_1',
  name: 'Linha oficial',
  subscription: 'sub_1',
  status: 'active',
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: null,
  metadata: {
    provider: 'HUBMESSAGE',
    hubmessageChannelId: 'chan_1',
    wabaId: 'waba_1',
  },
}

const zapiItem: SubscriptionItem = {
  id: 'item_zapi',
  name: 'Linha Z-API',
  subscription: 'sub_1',
  status: 'active',
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: null,
  metadata: {
    provider: 'ZAPI',
    zApiInstanceId: 'Z-1',
    zApiInstanceToken: 'tk',
  },
}

function makeProvider(overrides: Partial<WhatsAppTemplateProvider> = {}) {
  return {
    supportsTemplates: true,
    listTemplates: vi.fn().mockResolvedValue([]),
    createTemplate: vi.fn().mockResolvedValue({
      id: 'tpl_1',
      status: 'PENDING',
      category: 'UTILITY',
    }),
    syncTemplates: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as WhatsAppTemplateProvider
}

function makeSut(opts: { items?: SubscriptionItem[] } = {}) {
  const provider = makeProvider()

  const getAplicationContext = {
    execute: vi.fn().mockResolvedValue({
      customer: { id: 'domain_1' },
      aplication: { id: 'app_1', spaId: '42' },
      subscriptions: [
        { id: 'sub_1', status: 'active', items: opts.items ?? [hubItem] },
      ],
    }),
  } as unknown as GetAplicationContext

  const templateProviderResolver = {
    resolve: vi.fn().mockReturnValue(provider),
  } as unknown as TemplateProviderResolver

  return {
    provider,
    useCase: new CreateConnectorTemplateUseCase(
      getAplicationContext,
      templateProviderResolver,
    ),
  }
}

const validInput = {
  subscriptionItemId: 'item_1',
  domainId: 'domain_1',
  appCode: 'crmthink.thinkzap',
  name: 'order_update',
  category: 'UTILITY' as const,
  language: 'pt_BR',
  components: [{ type: 'BODY' as const, text: 'Olá {{1}}' }],
}

describe('CreateConnectorTemplateUseCase', () => {
  it('cria template com o wabaId do item da linha', async () => {
    const sut = makeSut()

    const result = await sut.useCase.execute(validInput)

    expect(sut.provider.createTemplate).toHaveBeenCalledWith({
      wabaId: 'waba_1',
      name: 'order_update',
      category: 'UTILITY',
      language: 'pt_BR',
      components: [{ type: 'BODY', text: 'Olá {{1}}' }],
    })
    expect(result.status).toBe('PENDING')
  })

  it('rejeita nome fora de snake_case antes de chamar o provider', async () => {
    const sut = makeSut()

    await expect(
      sut.useCase.execute({ ...validInput, name: 'Order Update' }),
    ).rejects.toBeInstanceOf(InvalidTemplateError)
    expect(sut.provider.createTemplate).not.toHaveBeenCalled()
  })

  it('rejeita quando não há componente BODY', async () => {
    const sut = makeSut()

    await expect(
      sut.useCase.execute({ ...validInput, components: [{ type: 'FOOTER' }] }),
    ).rejects.toBeInstanceOf(InvalidTemplateError)
  })

  it('repassa botões válidos ao provider', async () => {
    const sut = makeSut()
    const buttons = {
      type: 'BUTTONS' as const,
      buttons: [
        { type: 'QUICK_REPLY', text: 'Quero saber mais' },
        {
          type: 'URL',
          text: 'Rastrear',
          url: 'https://loja.com/p/{{1}}',
          example: ['https://loja.com/p/1'],
        },
      ],
    }

    await sut.useCase.execute({
      ...validInput,
      components: [...validInput.components, buttons],
    })

    expect(sut.provider.createTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        components: [{ type: 'BODY', text: 'Olá {{1}}' }, buttons],
      }),
    )
  })

  it('rejeita três botões de link sem chamar o provider', async () => {
    const sut = makeSut()
    const link = { type: 'URL', text: 'Ver', url: 'https://loja.com' }

    await expect(
      sut.useCase.execute({
        ...validInput,
        components: [
          ...validInput.components,
          { type: 'BUTTONS', buttons: [link, link, link] },
        ],
      }),
    ).rejects.toBeInstanceOf(InvalidTemplateError)
    expect(sut.provider.createTemplate).not.toHaveBeenCalled()
  })

  it('rejeita botões em template de autenticação', async () => {
    const sut = makeSut()

    await expect(
      sut.useCase.execute({
        ...validInput,
        category: 'AUTHENTICATION',
        components: [
          ...validInput.components,
          { type: 'BUTTONS', buttons: [{ type: 'QUICK_REPLY', text: 'Sim' }] },
        ],
      }),
    ).rejects.toThrow('Templates de autenticação não aceitam botões')
  })

  it('rejeita idioma vazio', async () => {
    const sut = makeSut()

    await expect(
      sut.useCase.execute({ ...validInput, language: '  ' }),
    ).rejects.toBeInstanceOf(InvalidTemplateError)
  })

  it('erro quando a linha não é do WhatsApp Oficial', async () => {
    const sut = makeSut({ items: [zapiItem] })

    await expect(
      sut.useCase.execute({ ...validInput, subscriptionItemId: 'item_zapi' }),
    ).rejects.toBeInstanceOf(ConnectorNotTemplateCapableError)
  })

  it('erro quando a linha não está na instalação do token', async () => {
    const sut = makeSut()

    await expect(
      sut.useCase.execute({ ...validInput, subscriptionItemId: 'de-outro' }),
    ).rejects.toBeInstanceOf(LineNotFoundError)
  })
})
