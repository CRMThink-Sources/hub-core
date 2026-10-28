import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { describe, expect, it, vi } from 'vitest'
import type { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import type { TemplateProviderResolver } from '@/modules/thinkzap/domain/ports/template-provider-resolver.port'
import type { Template } from '@/modules/thinkzap/domain/ports/whatsapp-template-provider.port'
import type { TemplateSampleImageFetcher } from '@/modules/thinkzap/domain/ports/template-sample-image-fetcher.port'
import type { TemplateImageStorage } from '@/modules/thinkzap/domain/ports/template-image-storage.port'
import type { TemplateDefaultsRepository } from '@/modules/thinkzap/domain/ports/template-defaults-repository.port'
import { TemplateNotFoundError } from '@/modules/thinkzap/domain/ports/template-errors'
import { InvalidTemplateHeaderImageError } from './helpers/template-definition'
import {
  TemplateNotEditableError,
  UpdateConnectorTemplateUseCase,
} from './update-connector-template'

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

const template = (overrides: Partial<Template> = {}): Template => ({
  id: 'tpl_1',
  name: 'promo',
  category: 'MARKETING',
  language: 'pt_BR',
  status: 'REJECTED',
  components: [{ type: 'BODY', text: 'Oferta' }],
  ...overrides,
})

const defaultUrl = 'https://imagens.loja.com/template-defaults/d/x.png'
const storedUrl = 'https://imagens.loja.com/template-defaults/d/novo.png'

function makeSut(
  opts: {
    current?: Template
    defaults?: { headerImageUrl: string } | null
  } = {},
) {
  const getAplicationContext = {
    execute: vi.fn().mockResolvedValue({
      customer: { id: 'domain_1' },
      aplication: { id: 'app_1', spaId: '42' },
      subscriptions: [{ id: 'sub_1', status: 'active', items: [hubItem] }],
    }),
  } as unknown as GetAplicationContext
  const provider = {
    supportsTemplates: true,
    listTemplates: vi.fn().mockResolvedValue([opts.current ?? template()]),
    updateTemplate: vi.fn().mockResolvedValue(undefined),
  }
  const templateProviderResolver = {
    resolve: vi.fn().mockReturnValue(provider),
  } as unknown as TemplateProviderResolver
  const fetch = vi.fn().mockResolvedValue({})
  const store = vi.fn().mockResolvedValue({ url: storedUrl, key: 'k' })
  const find = vi
    .fn()
    .mockResolvedValue(
      opts.defaults === undefined
        ? { name: 'promo', language: 'pt_BR', headerImageUrl: defaultUrl }
        : opts.defaults,
    )
  const upsert = vi.fn().mockResolvedValue(undefined)

  return {
    provider,
    fetch,
    store,
    find,
    upsert,
    useCase: new UpdateConnectorTemplateUseCase(
      getAplicationContext,
      templateProviderResolver,
      { fetch } as unknown as TemplateSampleImageFetcher,
      { store } as unknown as TemplateImageStorage,
      { find, upsert } as unknown as TemplateDefaultsRepository,
    ),
  }
}

const base = {
  subscriptionItemId: 'item_1',
  domainId: 'domain_1',
  appCode: 'crmthink.thinkzap',
  templateId: 'tpl_1',
  name: 'promo',
  category: 'MARKETING' as const,
  language: 'pt_BR',
  components: [{ type: 'BODY' as const, text: 'Oferta nova {{1}}' }],
}

const imageTemplate = template({
  status: 'APPROVED',
  components: [
    { type: 'HEADER', format: 'IMAGE' },
    { type: 'BODY', text: 'Oferta' },
  ],
})

describe('UpdateConnectorTemplateUseCase', () => {
  it('reenvia template rejeitado com o corpo novo', async () => {
    const sut = makeSut()

    await sut.useCase.execute(base)

    expect(sut.provider.updateTemplate).toHaveBeenCalledWith({
      wabaId: 'waba_1',
      templateId: 'tpl_1',
      name: 'promo',
      category: 'MARKETING',
      language: 'pt_BR',
      components: base.components,
    })
  })

  it.each([
    ['template pendente', { current: template({ status: 'PENDING' }) }, {}],
    ['nome trocado', {}, { name: 'outro' }],
    ['idioma trocado', {}, { language: 'en_US' }],
    [
      'categoria trocada em aprovado',
      { current: template({ status: 'APPROVED' }) },
      { category: 'UTILITY' as const },
    ],
  ])('recusa %s sem chamar o provider', async (_, opts, change) => {
    const sut = makeSut(opts)

    await expect(
      sut.useCase.execute({ ...base, ...change }),
    ).rejects.toBeInstanceOf(TemplateNotEditableError)
    expect(sut.provider.updateTemplate).not.toHaveBeenCalled()
  })

  it('permite trocar a categoria de template rejeitado', async () => {
    const sut = makeSut()

    await sut.useCase.execute({ ...base, category: 'UTILITY' })

    expect(sut.provider.updateTemplate).toHaveBeenCalled()
  })

  it('recusa template que não existe na linha', async () => {
    const sut = makeSut()

    await expect(
      sut.useCase.execute({ ...base, templateId: 'tpl_x' }),
    ).rejects.toBeInstanceOf(TemplateNotFoundError)
  })

  it('imagem mantida usa a imagem padrão como amostra, sem baixar nem regravar', async () => {
    const sut = makeSut({ current: imageTemplate })

    await sut.useCase.execute({
      ...base,
      components: [
        { type: 'HEADER', format: 'IMAGE' },
        { type: 'BODY', text: 'Oferta nova' },
      ],
    })

    const [input] = sut.provider.updateTemplate.mock.calls[0] as [
      { components: unknown[] },
    ]
    expect(input.components[0]).toEqual({
      type: 'HEADER',
      format: 'IMAGE',
      example: { imageUrl: defaultUrl },
    })
    expect(sut.fetch).not.toHaveBeenCalled()
    expect(sut.upsert).not.toHaveBeenCalled()
  })

  it('imagem mantida sem imagem padrão exige imagem nova', async () => {
    const sut = makeSut({ current: imageTemplate, defaults: null })

    await expect(
      sut.useCase.execute({
        ...base,
        components: [
          { type: 'HEADER', format: 'IMAGE' },
          { type: 'BODY', text: 'Oferta' },
        ],
      }),
    ).rejects.toBeInstanceOf(InvalidTemplateHeaderImageError)
    expect(sut.provider.updateTemplate).not.toHaveBeenCalled()
  })

  it('link novo é conferido e vira a imagem padrão', async () => {
    const sut = makeSut({ current: imageTemplate })

    await sut.useCase.execute({
      ...base,
      components: [
        {
          type: 'HEADER',
          format: 'IMAGE',
          example: { imageUrl: 'https://loja.com/nova.png' },
        },
        { type: 'BODY', text: 'Oferta' },
      ],
    })

    expect(sut.fetch).toHaveBeenCalledWith('https://loja.com/nova.png')
    expect(sut.upsert).toHaveBeenCalledWith(
      { domainId: 'domain_1', subscriptionItemId: 'item_1' },
      {
        name: 'promo',
        language: 'pt_BR',
        headerImageUrl: 'https://loja.com/nova.png',
      },
    )
  })

  it('arquivo novo vai para o bucket e vira a imagem padrão', async () => {
    const sut = makeSut({ current: imageTemplate })

    await sut.useCase.execute({
      ...base,
      components: [
        { type: 'HEADER', format: 'IMAGE' },
        { type: 'BODY', text: 'Oferta' },
      ],
      headerImageFile: {
        data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      },
    })

    expect(sut.store).toHaveBeenCalledWith(
      expect.objectContaining({ retention: 'permanent' }),
    )
    expect(sut.find).not.toHaveBeenCalled()
    expect(sut.upsert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ headerImageUrl: storedUrl }),
    )
  })
})
