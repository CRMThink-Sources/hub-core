import { TemplateProviderResolver } from '@/modules/thinkzap/domain/ports/template-provider-resolver.port'
import { Template } from '@/modules/thinkzap/domain/ports/whatsapp-template-provider.port'
import { GetConnectorRepository } from '@/modules/thinkzap/domain/repositories/get-connector.repository'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import { resolveTemplateContext } from './helpers/resolve-template-context'

/** Lista os templates de um conector oficial. */
export class ListConnectorTemplatesUseCase {
  constructor(
    private readonly getConnectorRepository: GetConnectorRepository,
    private readonly getInstanceRepository: GetInstanceRepository,
    private readonly templateProviderResolver: TemplateProviderResolver,
  ) {}

  async execute(connectorId: string): Promise<Template[]> {
    const { wabaId, provider } = await resolveTemplateContext(connectorId, {
      getConnectorRepository: this.getConnectorRepository,
      getInstanceRepository: this.getInstanceRepository,
      templateProviderResolver: this.templateProviderResolver,
    })

    return provider.listTemplates(wabaId)
  }
}
