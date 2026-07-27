/* eslint-disable @typescript-eslint/unbound-method */
import { describe, expect, it, vi } from 'vitest'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { ConnectorNotTemplateCapableError } from '@/modules/thinkzap/domain/ports/template-errors'
import { TemplateProviderResolver } from '@/modules/thinkzap/domain/ports/template-provider-resolver.port'
import { WhatsAppTemplateProvider } from '@/modules/thinkzap/domain/ports/whatsapp-template-provider.port'
import { GetConnectorRepository } from '@/modules/thinkzap/domain/repositories/get-connector.repository'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import {
  CreateConnectorTemplateUseCase,
  InvalidTemplateError,
} from './create-connector-template'

function makeProvider(overrides: Partial<WhatsAppTemplateProvider> = {}) {
  return {
    supportsTemplates: true,
    listTemplates: vi.fn().mockResolvedValue([]),
    createTemplate: vi
      .fn()
      .mockResolvedValue({ id: 'tpl_1', status: 'PENDING', category: 'UTILITY' }),
    syncTemplates: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as WhatsAppTemplateProvider
}

function makeDeps(opts: {
  connector?: unknown
  instance?: unknown
  provider?: WhatsAppTemplateProvider
}) {
  const provider = opts.provider ?? makeProvider()
  const getConnectorRepository = {
    get: vi.fn().mockResolvedValue(opts.connector ?? null),
    getConnectorByInstanceId: vi.fn(),
  } as unknown as GetConnectorRepository
  const getInstanceRepository = {
    getInstance: vi.fn().mockResolvedValue(opts.instance ?? null),
    getInstanceByInstanceId: vi.fn(),
    getInstanceByChannelId: vi.fn(),
    getByDomainIdAndVinculatedChannel: vi.fn(),
  } as unknown as GetInstanceRepository
  const templateProviderResolver = {
    resolve: vi.fn().mockReturnValue(provider),
  } as unknown as TemplateProviderResolver
  return {
    provider,
    getConnectorRepository,
    getInstanceRepository,
    templateProviderResolver,
  }
}

const validInput = {
  connectorId: 'con_1',
  name: 'order_update',
  category: 'UTILITY' as const,
  language: 'pt_BR',
  components: [{ type: 'BODY' as const, text: 'Olá {{1}}' }],
}

describe('CreateConnectorTemplateUseCase', () => {
  it('cria template quando dados válidos e conector apto', async () => {
    const deps = makeDeps({
      connector: {
        id: 'con_1',
        instanceId: 'inst_1',
        provider: ConnectorProvider.HUBMESSAGE,
      },
      instance: { id: 'inst_1', wabaId: 'waba_1' },
    })
    const useCase = new CreateConnectorTemplateUseCase(
      deps.getConnectorRepository,
      deps.getInstanceRepository,
      deps.templateProviderResolver,
    )

    const result = await useCase.execute(validInput)

    expect(deps.provider.createTemplate).toHaveBeenCalledWith({
      wabaId: 'waba_1',
      name: 'order_update',
      category: 'UTILITY',
      language: 'pt_BR',
      components: [{ type: 'BODY', text: 'Olá {{1}}' }],
    })
    expect(result.status).toBe('PENDING')
  })

  it('rejeita nome fora de snake_case antes de chamar o provider', async () => {
    const deps = makeDeps({})
    const useCase = new CreateConnectorTemplateUseCase(
      deps.getConnectorRepository,
      deps.getInstanceRepository,
      deps.templateProviderResolver,
    )

    await expect(
      useCase.execute({ ...validInput, name: 'Order Update' }),
    ).rejects.toBeInstanceOf(InvalidTemplateError)
    expect(deps.provider.createTemplate).not.toHaveBeenCalled()
  })

  it('rejeita quando não há componente BODY', async () => {
    const deps = makeDeps({})
    const useCase = new CreateConnectorTemplateUseCase(
      deps.getConnectorRepository,
      deps.getInstanceRepository,
      deps.templateProviderResolver,
    )

    await expect(
      useCase.execute({ ...validInput, components: [{ type: 'FOOTER' }] }),
    ).rejects.toBeInstanceOf(InvalidTemplateError)
  })

  it('erro quando conector sem wabaId', async () => {
    const deps = makeDeps({
      connector: {
        id: 'con_1',
        instanceId: 'inst_1',
        provider: ConnectorProvider.HUBMESSAGE,
      },
      instance: { id: 'inst_1', wabaId: null },
    })
    const useCase = new CreateConnectorTemplateUseCase(
      deps.getConnectorRepository,
      deps.getInstanceRepository,
      deps.templateProviderResolver,
    )

    await expect(useCase.execute(validInput)).rejects.toBeInstanceOf(
      ConnectorNotTemplateCapableError,
    )
  })
})
