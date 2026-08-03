import { TemplateProviderResolver } from '@/modules/thinkzap/domain/ports/template-provider-resolver.port'
import { Template } from '@/modules/thinkzap/domain/ports/whatsapp-template-provider.port'
import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import {
  resolveTemplateContext,
  type ResolveTemplateContextInput,
} from './helpers/resolve-template-context'

/** Sincroniza o status dos templates de um conector com a Meta. */
export class SyncConnectorTemplatesUseCase {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly templateProviderResolver: TemplateProviderResolver,
  ) {}

  async execute(input: ResolveTemplateContextInput): Promise<Template[]> {
    const { wabaId, provider } = await resolveTemplateContext(input, {
      getAplicationContext: this.getAplicationContext,
      templateProviderResolver: this.templateProviderResolver,
    })

    return provider.syncTemplates(wabaId)
  }
}
