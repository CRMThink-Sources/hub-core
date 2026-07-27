/* eslint-disable @typescript-eslint/unbound-method */
import { describe, expect, it, vi } from 'vitest'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { TemplatesNotSupportedError } from '@/modules/thinkzap/domain/ports/template-errors'
import { TemplateProviderResolver } from '@/modules/thinkzap/domain/ports/template-provider-resolver.port'
import { WhatsAppTemplateProvider } from '@/modules/thinkzap/domain/ports/whatsapp-template-provider.port'
import { GetConnectorRepository } from '@/modules/thinkzap/domain/repositories/get-connector.repository'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import {
  ConnectorNotFoundError,
} from './helpers/resolve-template-context'
import { ListConnectorTemplatesUseCase } from './list-connector-templates'

function build(opts: {
  connector?: unknown
  instance?: unknown
  provider?: WhatsAppTemplateProvider
}) {
  const provider =
    opts.provider ??
    ({
      supportsTemplates: true,
      listTemplates: vi.fn().mockResolvedValue([{ id: 'tpl_1' }]),
      createTemplate: vi.fn(),
      syncTemplates: vi.fn(),
    } as unknown as WhatsAppTemplateProvider)
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
  const useCase = new ListConnectorTemplatesUseCase(
    getConnectorRepository,
    getInstanceRepository,
    templateProviderResolver,
  )
  return { useCase, provider }
}

describe('ListConnectorTemplatesUseCase', () => {
  it('retorna templates do provider quando conector apto', async () => {
    const { useCase, provider } = build({
      connector: {
        id: 'con_1',
        instanceId: 'inst_1',
        provider: ConnectorProvider.HUBMESSAGE,
      },
      instance: { id: 'inst_1', wabaId: 'waba_1' },
    })

    const result = await useCase.execute('con_1')

    expect(provider.listTemplates).toHaveBeenCalledWith('waba_1')
    expect(result).toEqual([{ id: 'tpl_1' }])
  })

  it('erro quando conector não existe', async () => {
    const { useCase } = build({ connector: null })
    await expect(useCase.execute('con_x')).rejects.toBeInstanceOf(
      ConnectorNotFoundError,
    )
  })

  it('propaga TemplatesNotSupportedError do resolver', async () => {
    const provider = {
      supportsTemplates: false,
      listTemplates: vi.fn(),
      createTemplate: vi.fn(),
      syncTemplates: vi.fn(),
    } as unknown as WhatsAppTemplateProvider
    const getConnectorRepository = {
      get: vi.fn().mockResolvedValue({
        id: 'con_1',
        instanceId: 'inst_1',
        provider: ConnectorProvider.ZAPI,
      }),
      getConnectorByInstanceId: vi.fn(),
    } as unknown as GetConnectorRepository
    const getInstanceRepository = {
      getInstance: vi.fn().mockResolvedValue({ id: 'inst_1', wabaId: 'waba_1' }),
      getInstanceByInstanceId: vi.fn(),
      getInstanceByChannelId: vi.fn(),
      getByDomainIdAndVinculatedChannel: vi.fn(),
    } as unknown as GetInstanceRepository
    const templateProviderResolver = {
      resolve: vi.fn().mockImplementation(() => {
        throw new TemplatesNotSupportedError('ZAPI')
      }),
    } as unknown as TemplateProviderResolver
    void provider

    const useCase = new ListConnectorTemplatesUseCase(
      getConnectorRepository,
      getInstanceRepository,
      templateProviderResolver,
    )

    await expect(useCase.execute('con_1')).rejects.toBeInstanceOf(
      TemplatesNotSupportedError,
    )
  })
})
