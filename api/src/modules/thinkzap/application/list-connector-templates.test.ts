import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
/* eslint-disable @typescript-eslint/unbound-method */
import { describe, expect, it, vi } from 'vitest'
import {
  ConnectorNotTemplateCapableError,
  TemplatesNotSupportedError,
} from '@/modules/thinkzap/domain/ports/template-errors'
import { TemplateProviderResolver } from '@/modules/thinkzap/domain/ports/template-provider-resolver.port'
import { WhatsAppTemplateProvider } from '@/modules/thinkzap/domain/ports/whatsapp-template-provider.port'
import { LineNotFoundError } from '@/modules/thinkzap/domain/errors/line-not-found.error'
import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import type { TemplateDefaultsRepository } from '@/modules/thinkzap/domain/ports/template-defaults-repository.port'
import { ListConnectorTemplatesUseCase } from './list-connector-templates'

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

const input = {
  subscriptionItemId: 'item_1',
  domainId: 'domain_1',
  appCode: 'crmthink.thinkzap',
}

function build(
  opts: {
    items?: SubscriptionItem[]
    resolve?: () => WhatsAppTemplateProvider
  } = {},
) {
  const provider = {
    supportsTemplates: true,
    listTemplates: vi.fn().mockResolvedValue([{ id: 'tpl_1', components: [] }]),
    createTemplate: vi.fn(),
    syncTemplates: vi.fn(),
  } as unknown as WhatsAppTemplateProvider

  const getAplicationContext = {
    execute: vi.fn().mockResolvedValue({
      customer: { id: 'domain_1' },
      aplication: { id: 'app_1', spaId: '42' },
      subscriptions: [{ id: 'sub_1', items: opts.items ?? [hubItem] }],
    }),
  } as unknown as GetAplicationContext

  const templateProviderResolver = {
    resolve: vi.fn().mockImplementation(opts.resolve ?? (() => provider)),
  } as unknown as TemplateProviderResolver

  return {
    provider,
    useCase: new ListConnectorTemplatesUseCase(
      getAplicationContext,
      templateProviderResolver,
    ),
  }
}

describe('ListConnectorTemplatesUseCase', () => {
  it('junta a imagem padrão do envio aos templates com cabeçalho de imagem', async () => {
    const { useCase, provider } = build()
    const image = {
      id: 'tpl_2',
      name: 'promo',
      language: 'pt_BR',
      components: [{ type: 'HEADER', format: 'IMAGE' }],
    }
    vi.mocked(provider.listTemplates).mockResolvedValue([
      image,
      { ...image, id: 'tpl_3', name: 'outro' },
    ] as never)
    const findMany = vi.fn().mockResolvedValue([
      {
        name: 'promo',
        language: 'pt_BR',
        headerImageUrl: 'https://cdn/a.png',
      },
    ])
    const withDefaults = new ListConnectorTemplatesUseCase(
      (useCase as unknown as { getAplicationContext: never })
        .getAplicationContext,
      (useCase as unknown as { templateProviderResolver: never })
        .templateProviderResolver,
      { findMany } as unknown as TemplateDefaultsRepository,
    )

    const result = await withDefaults.execute(input)

    expect(result.map(t => t.defaultImageUrl)).toEqual([
      'https://cdn/a.png',
      undefined,
    ])
  })

  it('lista templates usando o wabaId do item da linha', async () => {
    const { useCase, provider } = build()

    const result = await useCase.execute(input)

    expect(provider.listTemplates).toHaveBeenCalledWith('waba_1')
    expect(result).toEqual([{ id: 'tpl_1', components: [] }])
  })

  it('erro quando a linha não está na instalação do token', async () => {
    const { useCase } = build()

    await expect(
      useCase.execute({ ...input, subscriptionItemId: 'de-outro' }),
    ).rejects.toBeInstanceOf(LineNotFoundError)
  })

  it('erro quando a linha não é do WhatsApp Oficial', async () => {
    const { useCase } = build({ items: [zapiItem] })

    await expect(
      useCase.execute({ ...input, subscriptionItemId: 'item_zapi' }),
    ).rejects.toBeInstanceOf(ConnectorNotTemplateCapableError)
  })

  it('propaga TemplatesNotSupportedError do resolver', async () => {
    const { useCase } = build({
      resolve: () => {
        throw new TemplatesNotSupportedError('ZAPI')
      },
    })

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(
      TemplatesNotSupportedError,
    )
  })
})
