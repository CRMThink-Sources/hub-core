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
  opts: { items?: SubscriptionItem[]; templates?: Template[] } = {},
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

  return {
    provider,
    useCase: new ListWidgetTemplatesUseCase(
      getAplicationContext,
      templateProviderResolver,
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
      },
    ])
  })

  it('não devolve id remoto, category, status nem components crus', async () => {
    const { useCase } = build()

    const [first] = await useCase.execute(input)

    expect(Object.keys(first ?? {}).sort()).toEqual([
      'body',
      'buttons',
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
