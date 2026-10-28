import {
  CreateTemplateInput,
  CreatedTemplate,
  Template,
  TemplateComponent,
  UpdateTemplateInput,
  WhatsAppTemplateProvider,
} from '@/modules/thinkzap/domain/ports/whatsapp-template-provider.port'
import { headerImageExampleOf } from '@/modules/thinkzap/domain/template-header'
import { HubMessageClient } from '@/modules/thinkzap/infra/clients/hubmessage.client'
import {
  CreateTemplateParams,
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
    const created = await this.client.createTemplate(
      input.wabaId,
      await this.templateParams(input),
    )
    return {
      id: created.id,
      status: created.status,
      category: created.category,
    }
  }

  async updateTemplate(input: UpdateTemplateInput): Promise<void> {
    await this.client.updateTemplate(
      input.wabaId,
      input.templateId,
      await this.templateParams(input),
    )
  }

  /**
   * Corpo do cadastro, igual na criação e na edição.
   *
   * Arquivo: sobe primeiro e usa logo em seguida, no mesmo request — o `h` que a
   * Omni devolve expira. Link: vai direto em `header_handle`.
   */
  private async templateParams(
    input: CreateTemplateInput,
  ): Promise<CreateTemplateParams> {
    const uploadedHandle = input.headerSampleImage
      ? (
          await this.client.uploadTemplateMedia(input.wabaId, {
            data: input.headerSampleImage.data,
            contentType: input.headerSampleImage.contentType,
            fileName:
              input.headerSampleImage.contentType === 'image/png'
                ? 'header.png'
                : 'header.jpg',
          })
        ).h
      : undefined

    return {
      name: input.name,
      category: input.category,
      language: input.language,
      // A Meta reprova o template quando o formato de parâmetro não é declarado
      // e o texto usa `{{1}}`; `allow_category_change` evita rejeição quando ela
      // reclassifica a categoria por conta própria.
      allow_category_change: true,
      parameter_format: 'POSITIONAL',
      components: input.components.map(component =>
        toRawComponent(component, uploadedHandle),
      ),
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
 * Cabeçalho de imagem neutro → `example.header_handle`: o `h` do upload quando a
 * imagem veio como arquivo, ou o link público (`example.imageUrl`), que a Omni
 * converte no identificador da Meta (ver `CreateTemplateParams`). O resto vai como
 * veio.
 */
function toRawComponent(
  component: TemplateComponent,
  uploadedHandle: string | undefined,
): HubMessageTemplateComponent {
  if (component.type !== 'HEADER' || component.format !== 'IMAGE') {
    return { ...component }
  }

  const handle = uploadedHandle ?? headerImageExampleOf([component])
  if (!handle) return { ...component }

  return { ...component, example: { header_handle: [handle] } }
}
