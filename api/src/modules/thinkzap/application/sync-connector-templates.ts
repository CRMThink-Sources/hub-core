import { TemplateProviderResolver } from '@/modules/thinkzap/domain/ports/template-provider-resolver.port'
import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import type { TemplateDefaultsRepository } from '@/modules/thinkzap/domain/ports/template-defaults-repository.port'
import {
  resolveTemplateContext,
  type ResolveTemplateContextInput,
} from './helpers/resolve-template-context'
import {
  ConnectorTemplate,
  withDefaultImages,
} from './list-connector-templates'

/** Sincroniza o status dos templates de um conector com a Meta. */
export class SyncConnectorTemplatesUseCase {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly templateProviderResolver: TemplateProviderResolver,
    private readonly templateDefaults: TemplateDefaultsRepository | null = null,
  ) {}

  async execute(
    input: ResolveTemplateContextInput,
  ): Promise<ConnectorTemplate[]> {
    /**
     * `requireEnabled`: sincronizar reescreve o cadastro local a partir da Meta e
     * é operação que o cliente dispara — linha bloqueada recusa, junto com criar.
     * Só a **listagem** do que já está gravado continua aberta.
     */
    const { wabaId, provider } = await resolveTemplateContext(
      input,
      {
        getAplicationContext: this.getAplicationContext,
        templateProviderResolver: this.templateProviderResolver,
      },
      { requireEnabled: true },
    )

    const templates = await provider.syncTemplates(wabaId)
    return withDefaultImages(templates, this.templateDefaults, input)
  }
}
