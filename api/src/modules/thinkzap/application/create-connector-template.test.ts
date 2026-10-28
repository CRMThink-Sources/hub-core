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
  TemplateSampleImageError,
  TemplateSampleImageFetcher,
} from '@/modules/thinkzap/domain/ports/template-sample-image-fetcher.port'
import {
  TemplateImageStorage,
  TemplateImageStorageUnavailableError,
} from '@/modules/thinkzap/domain/ports/template-image-storage.port'
import type { TemplateDefaultsRepository } from '@/modules/thinkzap/domain/ports/template-defaults-repository.port'
import {
  CreateConnectorTemplateUseCase,
  InvalidTemplateError,
  InvalidTemplateHeaderImageError,
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

function makeSut(
  opts: {
    items?: SubscriptionItem[]
    fetch?: ReturnType<typeof vi.fn>
    imageStorage?: TemplateImageStorage | null
    upsert?: ReturnType<typeof vi.fn>
  } = {},
) {
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

  const sampleImageFetcher = {
    fetch:
      opts.fetch ??
      vi.fn().mockResolvedValue({
        data: Buffer.from('png'),
        contentType: 'image/png',
      }),
  } as unknown as TemplateSampleImageFetcher

  const templateDefaults = {
    find: vi.fn(),
    findMany: vi.fn(),
    upsert: opts.upsert ?? vi.fn().mockResolvedValue(undefined),
  }

  return {
    provider,
    sampleImageFetcher,
    templateDefaults,
    useCase: new CreateConnectorTemplateUseCase(
      getAplicationContext,
      templateProviderResolver,
      sampleImageFetcher,
      opts.imageStorage ?? null,
      templateDefaults as unknown as TemplateDefaultsRepository,
    ),
  }
}

const imageHeader = (imageUrl: string) => ({
  type: 'HEADER' as const,
  format: 'IMAGE',
  example: { imageUrl },
})

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

  it('baixa a imagem de exemplo e repassa o cabeçalho ao provider', async () => {
    const sut = makeSut()
    const header = imageHeader('https://loja.com/banner.png')

    await sut.useCase.execute({
      ...validInput,
      category: 'MARKETING',
      components: [header, ...validInput.components],
    })

    expect(sut.sampleImageFetcher.fetch).toHaveBeenCalledWith(
      'https://loja.com/banner.png',
    )
    expect(sut.provider.createTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        components: [header, { type: 'BODY', text: 'Olá {{1}}' }],
      }),
    )
  })

  describe('imagem padrão do envio', () => {
    const scope = { domainId: 'domain_1', subscriptionItemId: 'item_1' }
    const imageInput = {
      ...validInput,
      category: 'MARKETING' as const,
      components: [
        imageHeader('https://loja.com/banner.png'),
        ...validInput.components,
      ],
    }

    it('o link de exemplo vira a imagem padrão depois de criar', async () => {
      const sut = makeSut()

      await sut.useCase.execute(imageInput)

      expect(sut.templateDefaults.upsert).toHaveBeenCalledWith(scope, {
        name: 'order_update',
        language: 'pt_BR',
        headerImageUrl: 'https://loja.com/banner.png',
      })
    })

    it('template sem imagem não grava imagem padrão', async () => {
      const sut = makeSut()

      await sut.useCase.execute(validInput)

      expect(sut.templateDefaults.upsert).not.toHaveBeenCalled()
    })

    it('falha ao gravar a imagem padrão não desfaz a criação', async () => {
      const sut = makeSut({
        upsert: vi.fn().mockRejectedValue(new Error('db fora')),
      })

      await expect(sut.useCase.execute(imageInput)).resolves.toMatchObject({
        id: 'tpl_1',
      })
    })

    it('provider recusando não grava imagem padrão', async () => {
      const sut = makeSut()
      vi.mocked(sut.provider.createTemplate).mockRejectedValue(
        new Error('meta recusou'),
      )

      await expect(sut.useCase.execute(imageInput)).rejects.toThrow(
        'meta recusou',
      )
      expect(sut.templateDefaults.upsert).not.toHaveBeenCalled()
    })
  })

  it('não baixa nada em template sem cabeçalho', async () => {
    const sut = makeSut()

    await sut.useCase.execute(validInput)

    expect(sut.sampleImageFetcher.fetch).not.toHaveBeenCalled()
  })

  it.each([
    [
      'cabeçalho em Autenticação',
      'AUTHENTICATION' as const,
      [imageHeader('https://loja.com/a.png')],
      'Templates de autenticação não aceitam cabeçalho',
    ],
    [
      'dois cabeçalhos',
      'MARKETING' as const,
      [
        imageHeader('https://loja.com/a.png'),
        imageHeader('https://loja.com/b.png'),
      ],
      'no máximo um cabeçalho',
    ],
    [
      'exemplo sem https',
      'MARKETING' as const,
      [imageHeader('http://loja.com/a.png')],
      'URL https',
    ],
    [
      'exemplo do CDN da Meta',
      'MARKETING' as const,
      [imageHeader('https://scontent.whatsapp.net/v/t61/abc.jpg')],
      'Link do WhatsApp/Meta',
    ],
  ])(
    'rejeita %s sem baixar nem chamar o provider',
    async (_, category, headers, message) => {
      const sut = makeSut()

      const error: unknown = await sut.useCase
        .execute({
          ...validInput,
          category,
          components: [...headers, ...validInput.components],
        })
        .catch((e: unknown) => e)

      expect(error).toBeInstanceOf(InvalidTemplateHeaderImageError)
      expect((error as Error).message).toContain(message)
      expect(sut.sampleImageFetcher.fetch).not.toHaveBeenCalled()
      expect(sut.provider.createTemplate).not.toHaveBeenCalled()
    },
  )

  it('rejeita imagem de exemplo maior que 5 MB sem chamar o provider', async () => {
    const sut = makeSut({
      fetch: vi
        .fn()
        .mockRejectedValue(new TemplateSampleImageError('too_large')),
    })

    await expect(
      sut.useCase.execute({
        ...validInput,
        category: 'MARKETING',
        components: [
          imageHeader('https://loja.com/grande.png'),
          ...validInput.components,
        ],
      }),
    ).rejects.toThrow('A imagem de exemplo passa de 5 MB')
    expect(sut.provider.createTemplate).not.toHaveBeenCalled()
  })

  describe('imagem de exemplo por arquivo, com o bucket configurado', () => {
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
    ])
    const url = 'https://imagens.loja.com/template-headers/domain_1/x.png'
    const fileInput = {
      ...validInput,
      category: 'MARKETING' as const,
      components: [
        { type: 'HEADER' as const, format: 'IMAGE' },
        ...validInput.components,
      ],
      headerImageFile: { data: png },
    }
    const storage = () => {
      const store = vi.fn().mockResolvedValue({ url, key: 'x.png' })
      return { store, storage: { store } as unknown as TemplateImageStorage }
    }

    it('hospeda o arquivo e cria pelo caminho do link', async () => {
      const { store, storage: imageStorage } = storage()
      const sut = makeSut({ imageStorage })

      await sut.useCase.execute(fileInput)

      expect(store).toHaveBeenCalledWith({
        data: png,
        contentType: 'image/png',
        scope: { domainId: 'domain_1' },
        retention: 'permanent',
      })
      const [created] =
        vi.mocked(sut.provider.createTemplate).mock.calls[0] ?? []
      expect(created?.components[0]).toEqual({
        type: 'HEADER',
        format: 'IMAGE',
        example: { imageUrl: url },
      })
      expect(created).not.toHaveProperty('headerSampleImage')
      // A URL é nossa: não é baixada de novo para conferência.
      expect(sut.sampleImageFetcher.fetch).not.toHaveBeenCalled()
      // O mesmo arquivo vira a imagem padrão do envio.
      expect(sut.templateDefaults.upsert).toHaveBeenCalledWith(
        { domainId: 'domain_1', subscriptionItemId: 'item_1' },
        { name: 'order_update', language: 'pt_BR', headerImageUrl: url },
      )
    })

    it('não hospeda nada quando a linha recusa', async () => {
      const { store, storage: imageStorage } = storage()
      const sut = makeSut({ imageStorage })

      await expect(
        sut.useCase.execute({ ...fileInput, subscriptionItemId: 'de-outro' }),
      ).rejects.toBeInstanceOf(LineNotFoundError)
      expect(store).not.toHaveBeenCalled()
    })

    it('bucket fora do ar não chama o provider', async () => {
      const sut = makeSut({
        imageStorage: {
          store: vi
            .fn()
            .mockRejectedValue(new TemplateImageStorageUnavailableError('x')),
        },
      })

      await expect(sut.useCase.execute(fileInput)).rejects.toBeInstanceOf(
        TemplateImageStorageUnavailableError,
      )
      expect(sut.provider.createTemplate).not.toHaveBeenCalled()
    })
  })

  describe('imagem de exemplo por arquivo', () => {
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(300 * 1024),
    ])
    const fileInput = (data: Buffer) => ({
      ...validInput,
      category: 'MARKETING' as const,
      components: [
        { type: 'HEADER' as const, format: 'IMAGE' },
        ...validInput.components,
      ],
      headerImageFile: { data },
    })

    it('repassa o PNG ao provider sem baixar link', async () => {
      const sut = makeSut()

      await sut.useCase.execute(fileInput(png))

      expect(sut.sampleImageFetcher.fetch).not.toHaveBeenCalled()
      expect(sut.provider.createTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          headerSampleImage: { data: png, contentType: 'image/png' },
        }),
      )
    })

    it('recusa PDF renomeado para .png sem chamar o provider', async () => {
      const sut = makeSut()

      await expect(
        sut.useCase.execute(fileInput(Buffer.from('%PDF-1.7 ...'))),
      ).rejects.toThrow('JPEG ou PNG')
      expect(sut.provider.createTemplate).not.toHaveBeenCalled()
    })

    it('recusa arquivo de 6 MB', async () => {
      const sut = makeSut()
      const big = Buffer.concat([png, Buffer.alloc(6 * 1024 * 1024)])

      await expect(sut.useCase.execute(fileInput(big))).rejects.toThrow(
        'passa de 5 MB',
      )
      expect(sut.provider.createTemplate).not.toHaveBeenCalled()
    })

    it('recusa arquivo junto com link', async () => {
      const sut = makeSut()

      await expect(
        sut.useCase.execute({
          ...fileInput(png),
          components: [
            imageHeader('https://loja.com/a.png'),
            ...validInput.components,
          ],
        }),
      ).rejects.toBeInstanceOf(InvalidTemplateHeaderImageError)
      expect(sut.provider.createTemplate).not.toHaveBeenCalled()
    })
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
