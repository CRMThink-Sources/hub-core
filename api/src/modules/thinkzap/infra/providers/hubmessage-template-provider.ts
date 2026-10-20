import {
  CreateTemplateInput,
  CreatedTemplate,
  Template,
  TemplateComponent,
  WhatsAppTemplateProvider,
} from '@/modules/thinkzap/domain/ports/whatsapp-template-provider.port'
import { headerImageExampleOf } from '@/modules/thinkzap/domain/template-header'
import { HubMessageClient } from '@/modules/thinkzap/infra/clients/hubmessage.client'
import {
  HubMessageTemplate,
  HubMessageTemplateComponent,
} from '@/modules/thinkzap/infra/clients/types/hubmessage.types'

/**
 * Adapter HubMessage do contrato `WhatsAppTemplateProvider`. Mapeia os payloads
 * crus da API (`/whatsapp/businesses/{wabaId}/templates`) para os tipos neutros
 * do domínio, mantendo a aplicação desacoplada da API concreta.
 */
export class HubMessageTemplateProvider implements WhatsAppTemplateProvider {
  readonly supportsTemplates = true

  constructor(private readonly client: HubMessageClient) {}

  async listTemplates(wabaId: string): Promise<Template[]> {
    const { data } = await this.client.listTemplates(wabaId)
    return data.map(toDomainTemplate)
  }

  async createTemplate(input: CreateTemplateInput): Promise<CreatedTemplate> {
    const created = await this.client.createTemplate(input.wabaId, {
      name: input.name,
      category: input.category,
      language: input.language,
      // A Meta reprova o template quando o formato de parâmetro não é declarado
      // e o texto usa `{{1}}`; `allow_category_change` evita rejeição quando ela
      // reclassifica a categoria por conta própria.
      allow_category_change: true,
      parameter_format: 'POSITIONAL',
      components: input.components.map(toRawComponent),
    })
    return {
      id: created.id,
      status: created.status,
      category: created.category,
    }
  }

  async syncTemplates(wabaId: string): Promise<Template[]> {
    const { data } = await this.client.syncTemplates(wabaId)
    return data.map(toDomainTemplate)
  }
}

function toDomainTemplate(raw: HubMessageTemplate): Template {
  return {
    id: raw.id,
    name: raw.name,
    category: raw.category,
    language: raw.language,
    status: raw.status,
    components: raw.components.map(toDomainComponent),
  }
}

function toDomainComponent(
  raw: HubMessageTemplateComponent,
): TemplateComponent {
  return { ...raw }
}

/**
 * Cabeçalho de imagem neutro (`example.imageUrl`) → `example.header_handle` com o
 * link público, que a Omni converte no identificador da Meta antes de criar o
 * template (ver `CreateTemplateParams`). O resto vai como veio.
 */
function toRawComponent(
  component: TemplateComponent,
): HubMessageTemplateComponent {
  const imageUrl =
    component.type === 'HEADER' && component.format === 'IMAGE'
      ? headerImageExampleOf([component])
      : undefined
  if (!imageUrl) return { ...component }

  return { ...component, example: { header_handle: [imageUrl] } }
}
