import { TemplateProviderResolver } from '@/modules/thinkzap/domain/ports/template-provider-resolver.port'
import { Template } from '@/modules/thinkzap/domain/ports/whatsapp-template-provider.port'
import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import type { TemplateDefaultsRepository } from '@/modules/thinkzap/domain/ports/template-defaults-repository.port'
import { templateHeaderOf } from '@/modules/thinkzap/domain/template-header'
import {
  resolveTemplateContext,
  type ResolveTemplateContextInput,
} from './helpers/resolve-template-context'
import { loadDefaultImages } from './helpers/template-default-images'

/**
 * Template da tela de configuração: o da Meta, mais a imagem padrão do envio
 * quando o template tem cabeçalho de imagem e ela foi definida.
 */
export type ConnectorTemplate = Template & { defaultImageUrl?: string }

/** Junta a imagem padrão do envio a cada template com cabeçalho de imagem. */
export async function withDefaultImages(
  templates: Template[],
  repository: TemplateDefaultsRepository | null,
  input: ResolveTemplateContextInput,
): Promise<ConnectorTemplate[]> {
  if (!templates.some(t => templateHeaderOf(t.components) === 'IMAGE')) {
    return templates
  }
  const defaultImageOf = await loadDefaultImages(repository, input)
  return templates.map(template => {
    const defaultImageUrl =
      templateHeaderOf(template.components) === 'IMAGE'
        ? defaultImageOf(template)
        : undefined
    return defaultImageUrl ? { ...template, defaultImageUrl } : template
  })
}

/** Lista os templates de um conector oficial. */
export class ListConnectorTemplatesUseCase {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly templateProviderResolver: TemplateProviderResolver,
    private readonly templateDefaults: TemplateDefaultsRepository | null = null,
  ) {}

  async execute(
    input: ResolveTemplateContextInput,
  ): Promise<ConnectorTemplate[]> {
    const { wabaId, provider } = await resolveTemplateContext(input, {
      getAplicationContext: this.getAplicationContext,
      templateProviderResolver: this.templateProviderResolver,
    })

    const templates = await provider.listTemplates(wabaId)
    return withDefaultImages(templates, this.templateDefaults, input)
  }
}
