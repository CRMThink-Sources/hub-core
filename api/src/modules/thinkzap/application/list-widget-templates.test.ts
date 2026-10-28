/* eslint-disable @typescript-eslint/unbound-method */
import { describe, expect, it, vi } from 'vitest'
import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { LineNotFoundError } from '@/modules/thinkzap/domain/errors/line-not-found.error'
import {
  ChannelNotConnectedError,
  ConnectorNotTemplateCapableError,
} from '@/modules/thinkzap/domain/ports/template-errors'
import { TemplateProviderResolver } from '@/modules/thinkzap/domain/ports/template-provider-resolver.port'
import {
  Template,
  WhatsAppTemplateProvider,
} from '@/modules/thinkzap/domain/ports/whatsapp-template-provider.port'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import type { TemplateDefaultsRepository } from '@/modules/thinkzap/domain/ports/template-defaults-repository.port'
import { ListWidgetTemplatesUseCase } from './list-widget-templates'

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

const hubItemWithoutWaba: SubscriptionItem = {
  ...hubItem,
  id: 'item_sem_waba',
  metadata: { provider: 'HUBMESSAGE', hubmessageChannelId: 'chan_2' },
}

const zapiItem: SubscriptionItem = {
  ...hubItem,
  id: 'item_zapi',
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

function template(overrides: Partial<Template> = {}): Template {
  return {
    id: 'tpl_1',
    name: 'order_update',
    category: 'UTILITY',
    language: 'pt_BR',
    status: 'APPROVED',
    components: [{ type: 'BODY', text: 'Olá {{1}}, seu pedido {{2}} saiu.' }],
    ...overrides,
  }
}

function build(
  opts: {
    items?: SubscriptionItem[]
    templates?: Template[]
    defaults?: { name: string; language: string; headerImageUrl: string }[]
  } = {},
) {
  const provider = {
    supportsTemplates: true,
    listTemplates: vi.fn().mockResolvedValue(opts.templates ?? [template()]),
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
    resolve: vi.fn().mockReturnValue(provider),
  } as unknown as TemplateProviderResolver

  const templateDefaults = {
    find: vi.fn(),
    findMany: vi.fn().mockResolvedValue(opts.defaults ?? []),
    upsert: vi.fn(),
  }

  return {
    provider,
    templateDefaults,
    useCase: new ListWidgetTemplatesUseCase(
      getAplicationContext,
      templateProviderResolver,
      templateDefaults as unknown as TemplateDefaultsRepository,
    ),
  }
}

describe('ListWidgetTemplatesUseCase', () => {
  it('devolve nome, idioma e corpo do template, usando o wabaId do item', async () => {
    const { useCase, provider } = build()

    const result = await useCase.execute(input)

    expect(provider.listTemplates).toHaveBeenCalledWith('waba_1')
    expect(result).toEqual([
      {
        name: 'order_update',
        language: 'pt_BR',
        body: 'Olá {{1}}, seu pedido {{2}} saiu.',
        buttons: [],
        header: { type: 'NONE' },
      },
    ])
  })

  it('não devolve id remoto, category, status nem components crus', async () => {
    const { useCase } = build()

    const [first] = await useCase.execute(input)

    expect(Object.keys(first ?? {}).sort()).toEqual([
      'body',
      'buttons',
      'header',
      'language',
      'name',
    ])
  })

  it('devolve os botões marcando só o link com variável como dinâmico', async () => {
    const { useCase } = build({
      templates: [
        template({
          components: [
            { type: 'BODY', text: 'Seu pedido saiu' },
            {
              type: 'BUTTONS',
              buttons: [
                { type: 'QUICK_REPLY', text: 'Obrigado' },
                {
                  type: 'URL',
                  text: 'Rastrear',
                  url: 'https://loja.com/pedido/{{1}}',
                  example: ['https://loja.com/pedido/1'],
                },
              ],
            },
          ],
        }),
      ],
    })

    const [first] = await useCase.execute(input)

    expect(first?.buttons).toEqual([
      { index: 0, type: 'QUICK_REPLY', text: 'Obrigado', dynamic: false },
      { index: 1, type: 'URL', text: 'Rastrear', dynamic: true },
    ])
  })

  it('filtra fora templates pendentes e reprovados', async () => {
    const { useCase } = build({
      templates: [
        template({ name: 'aprovado', status: 'APPROVED' }),
        template({ id: 'tpl_2', name: 'pendente', status: 'PENDING' }),
        template({ id: 'tpl_3', name: 'reprovado', status: 'REJECTED' }),
      ],
    })

    const result = await useCase.execute(input)

    expect(result.map(item => item.name)).toEqual(['aprovado'])
  })

  it('oferece template com imagem marcando o cabeçalho', async () => {
    const { useCase } = build({
      templates: [
        template({
          components: [
            {
              type: 'HEADER',
              format: 'IMAGE',
              example: { header_handle: ['https://scontent.whatsapp.net/a'] },
            },
            { type: 'BODY', text: 'Oferta {{1}}' },
          ],
        }),
      ],
    })

    const [first] = await useCase.execute(input)

    expect(first?.header).toEqual({ type: 'IMAGE' })
  })

  it('leva a imagem padrão do envio no cabeçalho de imagem', async () => {
    const imageComponents: Template['components'] = [
      { type: 'HEADER', format: 'IMAGE' },
      { type: 'BODY', text: 'Oferta' },
    ]
    const { useCase, templateDefaults } = build({
      templates: [
        template({ name: 'com_padrao', components: imageComponents }),
        template({
          id: 'tpl_2',
          name: 'sem_padrao',
          components: imageComponents,
        }),
      ],
      defaults: [
        {
          name: 'com_padrao',
          language: 'pt_BR',
          headerImageUrl: 'https://cdn/a.png',
        },
      ],
    })

    const result = await useCase.execute(input)

    expect(templateDefaults.findMany).toHaveBeenCalledWith({
      domainId: 'domain_1',
      subscriptionItemId: 'item_1',
    })
    expect(result.map(t => t.header)).toEqual([
      { type: 'IMAGE', defaultImageUrl: 'https://cdn/a.png' },
      { type: 'IMAGE' },
    ])
  })

  it('não consulta imagens padrão quando nenhum template tem imagem', async () => {
    const { useCase, templateDefaults } = build()

    await useCase.execute(input)

    expect(templateDefaults.findMany).not.toHaveBeenCalled()
  })

  it('filtra fora template com vídeo e com texto variável no cabeçalho', async () => {
    const { useCase } = build({
      templates: [
        template({ name: 'sem_cabecalho' }),
        template({
          id: 'tpl_video',
          name: 'video',
          components: [
            { type: 'HEADER', format: 'VIDEO' },
            { type: 'BODY', text: 'Veja' },
          ],
        }),
        template({
          id: 'tpl_texto',
          name: 'texto_variavel',
          components: [
            { type: 'HEADER', format: 'TEXT', text: 'Oi {{1}}' },
            { type: 'BODY', text: 'Veja' },
          ],
        }),
      ],
    })

    const result = await useCase.execute(input)

    expect(result.map(item => item.name)).toEqual(['sem_cabecalho'])
  })

  it('corpo vazio quando o template não tem componente BODY', async () => {
    const { useCase } = build({
      templates: [template({ components: [{ type: 'HEADER', text: 'Oi' }] })],
    })

    const [first] = await useCase.execute(input)

    expect(first?.body).toBe('')
  })

  it('erro quando a linha não está na instalação do token', async () => {
    const { useCase } = build()

    await expect(
      useCase.execute({ ...input, subscriptionItemId: 'de-outro' }),
    ).rejects.toBeInstanceOf(LineNotFoundError)
  })

  it('erro de capacidade quando a linha é Z-API', async () => {
    const { useCase, provider } = build({ items: [zapiItem] })

    await expect(
      useCase.execute({ ...input, subscriptionItemId: 'item_zapi' }),
    ).rejects.toBeInstanceOf(ConnectorNotTemplateCapableError)
    expect(provider.listTemplates).not.toHaveBeenCalled()
  })

  it('erro de canal não conectado quando a linha oficial não tem wabaId', async () => {
    const { useCase, provider } = build({ items: [hubItemWithoutWaba] })

    await expect(
      useCase.execute({ ...input, subscriptionItemId: 'item_sem_waba' }),
    ).rejects.toBeInstanceOf(ChannelNotConnectedError)
    expect(provider.listTemplates).not.toHaveBeenCalled()
  })
})
