/* eslint-disable @typescript-eslint/unbound-method */
import { describe, expect, it, vi } from 'vitest'
import { HubMessageClient } from '@/modules/thinkzap/infra/clients/hubmessage.client'
import { HubMessageTemplate } from '@/modules/thinkzap/infra/clients/types/hubmessage.types'
import { HubMessageTemplateProvider } from './hubmessage-template-provider'

function rawTemplate(overrides: Partial<HubMessageTemplate> = {}) {
  return {
    id: 'tpl_1',
    name: 'order_update',
    status: 'APPROVED',
    category: 'UTILITY',
    language: 'pt_BR',
    components: [{ type: 'BODY', text: 'Olá {{1}}' }],
    ...overrides,
  } as HubMessageTemplate
}

function makeClient(overrides: Partial<HubMessageClient> = {}) {
  return {
    listTemplates: vi.fn().mockResolvedValue({ data: [rawTemplate()] }),
    createTemplate: vi.fn().mockResolvedValue({
      id: 'tpl_1',
      status: 'PENDING',
      category: 'UTILITY',
    }),
    syncTemplates: vi.fn().mockResolvedValue({ data: [rawTemplate()] }),
    ...overrides,
  } as unknown as HubMessageClient
}

describe('HubMessageTemplateProvider', () => {
  it('supportsTemplates é true', () => {
    expect(new HubMessageTemplateProvider(makeClient()).supportsTemplates).toBe(
      true,
    )
  })

  it('lista templates mapeando para o formato de domínio', async () => {
    const client = makeClient()
    const provider = new HubMessageTemplateProvider(client)

    const result = await provider.listTemplates('waba_1')

    expect(client.listTemplates).toHaveBeenCalledWith('waba_1')
    expect(result).toEqual([
      {
        id: 'tpl_1',
        name: 'order_update',
        category: 'UTILITY',
        language: 'pt_BR',
        status: 'APPROVED',
        components: [{ type: 'BODY', text: 'Olá {{1}}' }],
      },
    ])
  })

  it('cria template repassando components, wabaId e flags exigidas pela Meta', async () => {
    const client = makeClient()
    const provider = new HubMessageTemplateProvider(client)

    const result = await provider.createTemplate({
      wabaId: 'waba_1',
      name: 'order_update',
      category: 'UTILITY',
      language: 'pt_BR',
      components: [
        {
          type: 'BODY',
          text: 'Olá {{1}}',
          example: { body_text: [['João']] },
        },
      ],
    })

    expect(client.createTemplate).toHaveBeenCalledWith('waba_1', {
      name: 'order_update',
      category: 'UTILITY',
      language: 'pt_BR',
      allow_category_change: true,
      parameter_format: 'POSITIONAL',
      components: [
        {
          type: 'BODY',
          text: 'Olá {{1}}',
          example: { body_text: [['João']] },
        },
      ],
    })
    expect(result).toEqual({
      id: 'tpl_1',
      status: 'PENDING',
      category: 'UTILITY',
    })
  })

  it('traduz o cabeçalho de imagem neutro para header_handle com o link', async () => {
    const client = makeClient()
    const provider = new HubMessageTemplateProvider(client)

    await provider.createTemplate({
      wabaId: 'waba_1',
      name: 'promo',
      category: 'MARKETING',
      language: 'pt_BR',
      components: [
        {
          type: 'HEADER',
          format: 'IMAGE',
          example: { imageUrl: 'https://loja.com/banner.png' },
        },
        { type: 'BODY', text: 'Oferta {{1}}' },
      ],
    })

    expect(client.createTemplate).toHaveBeenCalledWith(
      'waba_1',
      expect.objectContaining({
        components: [
          {
            type: 'HEADER',
            format: 'IMAGE',
            example: { header_handle: ['https://loja.com/banner.png'] },
          },
          { type: 'BODY', text: 'Oferta {{1}}' },
        ],
      }),
    )
  })

  it('sobe o arquivo e cria com o h devolvido em header_handle', async () => {
    const uploadTemplateMedia = vi.fn().mockResolvedValue({ h: '4::aW1hZ2U=' })
    const client = makeClient({ uploadTemplateMedia })
    const provider = new HubMessageTemplateProvider(client)
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47])

    await provider.createTemplate({
      wabaId: 'waba_1',
      name: 'promo',
      category: 'MARKETING',
      language: 'pt_BR',
      components: [
        { type: 'HEADER', format: 'IMAGE' },
        { type: 'BODY', text: 'Oferta {{1}}' },
      ],
      headerSampleImage: { data: png, contentType: 'image/png' },
    })

    expect(uploadTemplateMedia).toHaveBeenCalledWith('waba_1', {
      data: png,
      contentType: 'image/png',
      fileName: 'header.png',
    })
    expect(client.createTemplate).toHaveBeenCalledWith(
      'waba_1',
      expect.objectContaining({
        components: [
          {
            type: 'HEADER',
            format: 'IMAGE',
            example: { header_handle: ['4::aW1hZ2U='] },
          },
          { type: 'BODY', text: 'Oferta {{1}}' },
        ],
      }),
    )
  })

  it('edita pelo id com o mesmo corpo da criação e o link em header_handle', async () => {
    const updateTemplate = vi.fn().mockResolvedValue({ success: true })
    const client = makeClient({ updateTemplate })
    const provider = new HubMessageTemplateProvider(client)

    await provider.updateTemplate({
      wabaId: 'waba_1',
      templateId: 'tpl_9',
      name: 'promo',
      category: 'MARKETING',
      language: 'pt_BR',
      components: [
        {
          type: 'HEADER',
          format: 'IMAGE',
          example: { imageUrl: 'https://loja.com/banner.png' },
        },
        { type: 'BODY', text: 'Oferta {{1}}' },
      ],
    })

    expect(updateTemplate).toHaveBeenCalledWith('waba_1', 'tpl_9', {
      name: 'promo',
      category: 'MARKETING',
      language: 'pt_BR',
      allow_category_change: true,
      parameter_format: 'POSITIONAL',
      components: [
        {
          type: 'HEADER',
          format: 'IMAGE',
          example: { header_handle: ['https://loja.com/banner.png'] },
        },
        { type: 'BODY', text: 'Oferta {{1}}' },
      ],
    })
  })

  it('edita com arquivo subindo antes e usando o h', async () => {
    const uploadTemplateMedia = vi.fn().mockResolvedValue({ h: 'h-1' })
    const updateTemplate = vi.fn().mockResolvedValue({ success: true })
    const client = makeClient({ uploadTemplateMedia, updateTemplate })
    const provider = new HubMessageTemplateProvider(client)

    await provider.updateTemplate({
      wabaId: 'waba_1',
      templateId: 'tpl_9',
      name: 'promo',
      category: 'MARKETING',
      language: 'pt_BR',
      components: [
        { type: 'HEADER', format: 'IMAGE' },
        { type: 'BODY', text: 'Oferta' },
      ],
      headerSampleImage: {
        data: Buffer.from([0xff, 0xd8, 0xff]),
        contentType: 'image/jpeg',
      },
    })

    expect(uploadTemplateMedia).toHaveBeenCalledWith(
      'waba_1',
      expect.objectContaining({ fileName: 'header.jpg' }),
    )
    const [, , params] = updateTemplate.mock.calls[0] as [
      string,
      string,
      { components: unknown[] },
    ]
    expect(params.components[0]).toEqual({
      type: 'HEADER',
      format: 'IMAGE',
      example: { header_handle: ['h-1'] },
    })
  })

  it('não cria o template quando o upload falha', async () => {
    const client = makeClient({
      uploadTemplateMedia: vi.fn().mockRejectedValue(new Error('422')),
    })
    const provider = new HubMessageTemplateProvider(client)

    await expect(
      provider.createTemplate({
        wabaId: 'waba_1',
        name: 'promo',
        category: 'MARKETING',
        language: 'pt_BR',
        components: [
          { type: 'HEADER', format: 'IMAGE' },
          { type: 'BODY', text: 'Oferta' },
        ],
        headerSampleImage: {
          data: Buffer.from('x'),
          contentType: 'image/jpeg',
        },
      }),
    ).rejects.toThrow('422')
    expect(client.createTemplate).not.toHaveBeenCalled()
  })

  it('repassa o componente BUTTONS sem perder url, example e phone_number', async () => {
    const client = makeClient()
    const provider = new HubMessageTemplateProvider(client)
    const buttons = {
      type: 'BUTTONS' as const,
      buttons: [
        { type: 'QUICK_REPLY', text: 'Sim' },
        {
          type: 'URL',
          text: 'Rastrear',
          url: 'https://loja.com/p/{{1}}',
          example: ['https://loja.com/p/1'],
        },
        { type: 'PHONE_NUMBER', text: 'Ligar', phone_number: '+5511999999999' },
        { type: 'COPY_CODE', example: 'BLACK10' },
      ],
    }

    await provider.createTemplate({
      wabaId: 'waba_1',
      name: 'promo',
      category: 'MARKETING',
      language: 'pt_BR',
      components: [{ type: 'BODY', text: 'Oi' }, buttons],
    })

    expect(client.createTemplate).toHaveBeenCalledWith(
      'waba_1',
      expect.objectContaining({
        components: [{ type: 'BODY', text: 'Oi' }, buttons],
      }),
    )
  })

  it('sincroniza templates', async () => {
    const client = makeClient({
      syncTemplates: vi
        .fn()
        .mockResolvedValue({ data: [rawTemplate({ status: 'PENDING' })] }),
    })
    const provider = new HubMessageTemplateProvider(client)

    const result = await provider.syncTemplates('waba_1')

    expect(client.syncTemplates).toHaveBeenCalledWith('waba_1')
    expect(result[0]?.status).toBe('PENDING')
  })
})
