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
