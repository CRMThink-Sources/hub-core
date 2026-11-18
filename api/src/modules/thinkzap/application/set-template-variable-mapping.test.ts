/* eslint-disable @typescript-eslint/unbound-method */
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { describe, expect, it, vi } from 'vitest'
import type { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import type { TemplateProviderResolver } from '@/modules/thinkzap/domain/ports/template-provider-resolver.port'
import type { Template } from '@/modules/thinkzap/domain/ports/whatsapp-template-provider.port'
import type { TemplateVariableMappingsRepository } from '@/modules/thinkzap/domain/ports/template-variable-mappings-repository.port'
import { TemplateNotFoundError } from '@/modules/thinkzap/domain/ports/template-errors'
import { InvalidTemplateError } from './helpers/template-definition'
import { SetTemplateVariableMappingUseCase } from './set-template-variable-mapping'

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

const template: Template = {
  id: 'tpl_1',
  name: 'pedido',
  category: 'UTILITY',
  language: 'pt_BR',
  status: 'APPROVED',
  components: [{ type: 'BODY', text: 'Olá {{1}}, seu pedido {{2}} saiu' }],
}

function makeSut() {
  const getAplicationContext = {
    execute: vi.fn().mockResolvedValue({
      customer: { id: 'domain_1' },
      aplication: { id: 'app_1', spaId: '42' },
      subscriptions: [{ id: 'sub_1', status: 'active', items: [hubItem] }],
    }),
  } as unknown as GetAplicationContext
  const provider = {
    supportsTemplates: true,
    listTemplates: vi.fn().mockResolvedValue([template]),
  }
  const resolver = {
    resolve: vi.fn().mockReturnValue(provider),
  } as unknown as TemplateProviderResolver
  const repository: TemplateVariableMappingsRepository = {
    find: vi.fn(),
    upsert: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  }
  const sut = new SetTemplateVariableMappingUseCase(
    getAplicationContext,
    resolver,
    repository,
  )
  return { sut, repository, provider }
}

const base = {
  domainId: 'domain_1',
  appCode: 'thinkzap',
  subscriptionItemId: 'item_1',
  name: 'pedido',
  language: 'pt_BR',
  entityTypeId: 2,
}

describe('SetTemplateVariableMappingUseCase', () => {
  it('guarda as ligações do tipo de entidade', async () => {
    const { sut, repository } = makeSut()
    const mappings = {
      '1': { source: 'contact' as const, fieldId: 'name' },
      '2': { source: 'self' as const, fieldId: 'opportunity' },
    }

    const result = await sut.execute({ ...base, mappings })

    expect(repository.upsert).toHaveBeenCalledWith(
      { domainId: 'domain_1', subscriptionItemId: 'item_1' },
      { name: 'pedido', language: 'pt_BR' },
      2,
      mappings,
    )
    expect(result).toEqual({ mappings })
  })

  it('substitui o mapeamento anterior, guardando só o que veio', async () => {
    const { sut, repository } = makeSut()

    await sut.execute({
      ...base,
      mappings: {
        '1': { source: 'self', fieldId: 'title' },
        '2': { source: 'self', fieldId: ' ' },
      },
    })

    expect(repository.upsert).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      2,
      { '1': { source: 'self', fieldId: 'title' } },
    )
  })

  it('todas as variáveis sem campo apagam o mapeamento do tipo', async () => {
    const { sut, repository } = makeSut()

    await sut.execute({
      ...base,
      mappings: { '1': { source: 'self', fieldId: '' } },
    })

    expect(repository.delete).toHaveBeenCalledWith(
      { domainId: 'domain_1', subscriptionItemId: 'item_1' },
      { name: 'pedido', language: 'pt_BR' },
      2,
    )
    expect(repository.upsert).not.toHaveBeenCalled()
  })

  it('recusa variável que não existe no corpo, sem guardar nada', async () => {
    const { sut, repository } = makeSut()

    await expect(
      sut.execute({
        ...base,
        mappings: { '9': { source: 'self', fieldId: 'title' } },
      }),
    ).rejects.toThrow(InvalidTemplateError)
    expect(repository.upsert).not.toHaveBeenCalled()
  })

  it('recusa origem não permitida para o tipo, sem chamar o provider', async () => {
    const { sut, repository, provider } = makeSut()

    await expect(
      sut.execute({
        ...base,
        entityTypeId: 4,
        mappings: { '1': { source: 'contact', fieldId: 'name' } },
      }),
    ).rejects.toThrow(InvalidTemplateError)
    expect(provider.listTemplates).not.toHaveBeenCalled()
    expect(repository.upsert).not.toHaveBeenCalled()
  })

  it('recusa template que não existe na linha', async () => {
    const { sut, repository } = makeSut()

    await expect(
      sut.execute({
        ...base,
        name: 'outro',
        mappings: { '1': { source: 'self', fieldId: 'title' } },
      }),
    ).rejects.toThrow(TemplateNotFoundError)
    expect(repository.upsert).not.toHaveBeenCalled()
  })
})
