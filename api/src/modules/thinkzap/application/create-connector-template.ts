import { TemplateProviderResolver } from '@/modules/thinkzap/domain/ports/template-provider-resolver.port'
import {
  CreatedTemplate,
  TemplateCategory,
  TemplateComponent,
} from '@/modules/thinkzap/domain/ports/whatsapp-template-provider.port'
import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { headerImageExampleOf } from '@/modules/thinkzap/domain/template-header'
import { TemplateSampleImageFetcher } from '@/modules/thinkzap/domain/ports/template-sample-image-fetcher.port'
import type { TemplateImageStorage } from '@/modules/thinkzap/domain/ports/template-image-storage.port'
import type { TemplateDefaultsRepository } from '@/modules/thinkzap/domain/ports/template-defaults-repository.port'
import { apiLogger } from '@/shared/infra/logger'
import { resolveTemplateContext } from './helpers/resolve-template-context'
import {
  assertSampleImage,
  imageFromFile,
  validateTemplateDefinition,
  withHeaderImageUrl,
} from './helpers/template-definition'

export {
  InvalidTemplateError,
  InvalidTemplateHeaderImageError,
} from './helpers/template-definition'

export type CreateConnectorTemplateInput = {
  /** Id do item de assinatura — a linha. */
  subscriptionItemId: string
  domainId: string
  appCode: string
  name: string
  category: TemplateCategory
  language: string
  components: TemplateComponent[]
  /**
   * Arquivo da imagem de exemplo, quando o operador enviou um em vez do link.
   * Só os bytes: o tipo é decidido pela assinatura, não pelo que o navegador
   * declarou.
   */
  headerImageFile?: { data: Buffer }
}

/** Cadastra um template de um conector oficial (submete à aprovação da Meta). */
export class CreateConnectorTemplateUseCase {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly templateProviderResolver: TemplateProviderResolver,
    private readonly sampleImageFetcher: TemplateSampleImageFetcher,
    /**
     * Bucket da imagem do cabeçalho. Com ele, o arquivo enviado vira um link público
     * e segue pelo caminho do link (`header_handle` com URL), que a Omni aceita.
     * Sem ele (ambiente sem `R2_*`), o arquivo vai ao provider para a rota de upload
     * dele.
     */
    private readonly imageStorage: TemplateImageStorage | null = null,
    /**
     * Onde a imagem de exemplo vira a imagem padrão do envio. `null` desliga a
     * gravação (o template é criado igual).
     */
    private readonly templateDefaults: TemplateDefaultsRepository | null = null,
  ) {}

  async execute(input: CreateConnectorTemplateInput): Promise<CreatedTemplate> {
    validateTemplateDefinition(input)
    const headerSampleImage = input.headerImageFile
      ? imageFromFile(input.headerImageFile.data)
      : undefined
    if (!headerSampleImage) {
      await assertSampleImage(this.sampleImageFetcher, input.components)
    }

    /**
     * `requireEnabled`: cadastrar template é escrita no provider, e a linha
     * bloqueada recusa antes de submeter qualquer coisa à Meta.
     */
    const { wabaId, provider } = await resolveTemplateContext(
      input,
      {
        getAplicationContext: this.getAplicationContext,
        templateProviderResolver: this.templateProviderResolver,
      },
      { requireEnabled: true },
    )

    /**
     * Depois das recusas de linha: um envio recusado não deixa arquivo no bucket.
     * `permanent` porque o mesmo arquivo vira a imagem padrão do envio.
     */
    if (headerSampleImage && this.imageStorage) {
      const { url } = await this.imageStorage.store({
        data: headerSampleImage.data,
        contentType: headerSampleImage.contentType,
        scope: { domainId: input.domainId },
        retention: 'permanent',
      })
      const components = withHeaderImageUrl(input.components, url)
      const created = await provider.createTemplate({
        wabaId,
        name: input.name,
        category: input.category,
        language: input.language,
        components,
      })
      await this.saveDefaultImage(input, components)
      return created
    }

    const created = await provider.createTemplate({
      wabaId,
      name: input.name,
      category: input.category,
      language: input.language,
      components: input.components,
      ...(headerSampleImage ? { headerSampleImage } : {}),
    })
    // Arquivo pela rota de upload da Omni não tem URL: fica sem imagem padrão.
    if (!headerSampleImage) await this.saveDefaultImage(input, input.components)
    return created
  }

  /**
   * A imagem de exemplo vira a imagem padrão do envio. Falha aqui não desfaz a
   * criação: o template já está na Meta, e a imagem padrão pode ser definida depois
   * pela lista.
   */
  private async saveDefaultImage(
    input: CreateConnectorTemplateInput,
    components: TemplateComponent[],
  ): Promise<void> {
    const headerImageUrl = headerImageExampleOf(components)
    if (!headerImageUrl || !this.templateDefaults) return

    try {
      await this.templateDefaults.upsert(
        {
          domainId: input.domainId,
          subscriptionItemId: input.subscriptionItemId,
        },
        { name: input.name, language: input.language, headerImageUrl },
      )
    } catch (error) {
      apiLogger.warn(
        {
          app: 'thinkzap',
          domainId: input.domainId,
          subscriptionItemId: input.subscriptionItemId,
          template: input.name,
          err: error,
        },
        'Template criado, mas a imagem padrão do envio não foi gravada',
      )
    }
  }
}
