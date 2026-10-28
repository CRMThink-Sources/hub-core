/* eslint-disable @typescript-eslint/unbound-method */
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { describe, expect, it, vi } from 'vitest'
import type { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import type { TemplateProviderResolver } from '@/modules/thinkzap/domain/ports/template-provider-resolver.port'
import type { Template } from '@/modules/thinkzap/domain/ports/whatsapp-template-provider.port'
import {
  TemplateSampleImageError,
  type TemplateSampleImageFetcher,
} from '@/modules/thinkzap/domain/ports/template-sample-image-fetcher.port'
import {
  type TemplateImageStorage,
  TemplateImageStorageUnavailableError,
} from '@/modules/thinkzap/domain/ports/template-image-storage.port'
import type { TemplateDefaultsRepository } from '@/modules/thinkzap/domain/ports/template-defaults-repository.port'
import { TemplateNotFoundError } from '@/modules/thinkzap/domain/ports/template-errors'
import { InvalidTemplateHeaderImageError } from './helpers/template-definition'
import { SetTemplateDefaultImageUseCase } from './set-template-default-image'

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

const imageTemplate: Template = {
  id: 'tpl_1',
  name: 'promo',
  category: 'MARKETING',
  language: 'pt_BR',
  status: 'APPROVED',
  components: [
    { type: 'HEADER', format: 'IMAGE' },
    { type: 'BODY', text: 'Oferta' },
  ],
}

const textTemplate: Template = {
  ...imageTemplate,
  name: 'aviso',
  components: [{ type: 'BODY', text: 'Oi' }],
}

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const storedUrl = 'https://imagens.loja.com/template-defaults/domain_1/x.png'

function makeSut(
  opts: {
    fetch?: ReturnType<typeof vi.fn>
    imageStorage?: TemplateImageStorage | null
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
    listTemplates: vi.fn().mockResolvedValue([imageTemplate, textTemplate]),
  }
  const templateProviderResolver = {
    resolve: vi.fn().mockReturnValue(provider),
  } as unknown as TemplateProviderResolver
  const fetcher = {
    fetch: opts.fetch ?? vi.fn().mockResolvedValue({}),
  } as unknown as TemplateSampleImageFetcher
  const store = vi.fn().mockResolvedValue({ url: storedUrl, key: 'k' })
  const imageStorage =
    opts.imageStorage === undefined
      ? ({ store } as unknown as TemplateImageStorage)
      : opts.imageStorage
  const upsert = vi.fn().mockResolvedValue(undefined)

  return {
    store,
    upsert,
    fetcher,
    useCase: new SetTemplateDefaultImageUseCase(
      getAplicationContext,
      templateProviderResolver,
      fetcher,
      imageStorage,
      { upsert } as unknown as TemplateDefaultsRepository,
    ),
  }
}

const base = {
  subscriptionItemId: 'item_1',
  domainId: 'domain_1',
  appCode: 'crmthink.thinkzap',
  name: 'promo',
  language: 'pt_BR',
}
const scope = { domainId: 'domain_1', subscriptionItemId: 'item_1' }

describe('SetTemplateDefaultImageUseCase', () => {
  it('link válido vira a imagem padrão', async () => {
    const sut = makeSut()

    const result = await sut.useCase.execute({
      ...base,
      imageUrl: 'https://loja.com/promo.png',
    })

    expect(sut.fetcher.fetch).toHaveBeenCalledWith('https://loja.com/promo.png')
    expect(sut.upsert).toHaveBeenCalledWith(scope, {
      name: 'promo',
      language: 'pt_BR',
      headerImageUrl: 'https://loja.com/promo.png',
    })
    expect(result).toEqual({ headerImageUrl: 'https://loja.com/promo.png' })
  })

  it('arquivo vai para o bucket sem expiração', async () => {
    const sut = makeSut()

    await sut.useCase.execute({ ...base, imageFile: { data: png } })

    expect(sut.store).toHaveBeenCalledWith(
      expect.objectContaining({
        retention: 'permanent',
        contentType: 'image/png',
      }),
    )
    expect(sut.upsert).toHaveBeenCalledWith(scope, {
      name: 'promo',
      language: 'pt_BR',
      headerImageUrl: storedUrl,
    })
  })

  it('recusa link do CDN da Meta, que expira', async () => {
    const sut = makeSut({
      fetch: vi
        .fn()
        .mockRejectedValue(new TemplateSampleImageError('meta_cdn')),
    })

    await expect(
      sut.useCase.execute({
        ...base,
        imageUrl: 'https://scontent.whatsapp.net/v/t61/abc.jpg',
      }),
    ).rejects.toThrow('Link do WhatsApp/Meta expira')
    expect(sut.upsert).not.toHaveBeenCalled()
  })

  it('recusa PDF renomeado sem gravar nada', async () => {
    const sut = makeSut()

    await expect(
      sut.useCase.execute({
        ...base,
        imageFile: { data: Buffer.from('%PDF-1.4') },
      }),
    ).rejects.toThrow('A imagem padrão precisa ser um arquivo JPEG ou PNG')
    expect(sut.store).not.toHaveBeenCalled()
    expect(sut.upsert).not.toHaveBeenCalled()
  })

  it('recusa arquivo e link juntos, e nenhum dos dois', async () => {
    const sut = makeSut()

    await expect(
      sut.useCase.execute({
        ...base,
        imageUrl: 'https://loja.com/a.png',
        imageFile: { data: png },
      }),
    ).rejects.toBeInstanceOf(InvalidTemplateHeaderImageError)
    await expect(sut.useCase.execute(base)).rejects.toBeInstanceOf(
      InvalidTemplateHeaderImageError,
    )
  })

  it('recusa template sem cabeçalho de imagem', async () => {
    const sut = makeSut()

    await expect(
      sut.useCase.execute({
        ...base,
        name: 'aviso',
        imageUrl: 'https://loja.com/a.png',
      }),
    ).rejects.toThrow('não tem cabeçalho de imagem')
    expect(sut.upsert).not.toHaveBeenCalled()
  })

  it('recusa template que não existe na linha', async () => {
    const sut = makeSut()

    await expect(
      sut.useCase.execute({
        ...base,
        name: 'sumiu',
        imageUrl: 'https://loja.com/a.png',
      }),
    ).rejects.toBeInstanceOf(TemplateNotFoundError)
  })

  it('arquivo sem bucket configurado é armazenamento indisponível', async () => {
    const sut = makeSut({ imageStorage: null })

    await expect(
      sut.useCase.execute({ ...base, imageFile: { data: png } }),
    ).rejects.toBeInstanceOf(TemplateImageStorageUnavailableError)
    expect(sut.upsert).not.toHaveBeenCalled()
  })
})
