import { TemplateProviderResolver } from '@/modules/thinkzap/domain/ports/template-provider-resolver.port'
import {
  CreatedTemplate,
  TemplateCategory,
  TemplateComponent,
} from '@/modules/thinkzap/domain/ports/whatsapp-template-provider.port'
import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import {
  TEMPLATE_BUTTON_LIMITS,
  TemplateButtonViolation,
  validateTemplateButtons,
} from '@/modules/thinkzap/domain/template-buttons'
import {
  headerImageExampleOf,
  sniffTemplateImageType,
  TemplateHeaderViolation,
  validateTemplateHeader,
} from '@/modules/thinkzap/domain/template-header'
import {
  TEMPLATE_SAMPLE_IMAGE_MAX_BYTES,
  TemplateSampleImage,
  TemplateSampleImageError,
  TemplateSampleImageFailure,
  TemplateSampleImageFetcher,
} from '@/modules/thinkzap/domain/ports/template-sample-image-fetcher.port'
import type { TemplateImageStorage } from '@/modules/thinkzap/domain/ports/template-image-storage.port'
import { resolveTemplateContext } from './helpers/resolve-template-context'

/** Erro de validação de dados do template antes de submeter ao provider. */
export class InvalidTemplateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidTemplateError'
  }
}

/**
 * Cabeçalho de imagem inválido ou imagem de exemplo que não serve. Subclasse para o
 * controller registrar o código próprio do log, sem mudar a resposta (400).
 */
export class InvalidTemplateHeaderImageError extends InvalidTemplateError {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidTemplateHeaderImageError'
  }
}

const TEMPLATE_NAME_REGEX = /^[a-z0-9_]+$/
const VALID_CATEGORIES: TemplateCategory[] = [
  'UTILITY',
  'MARKETING',
  'AUTHENTICATION',
]

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
  ) {}

  async execute(input: CreateConnectorTemplateInput): Promise<CreatedTemplate> {
    this.validate(input)
    const headerSampleImage = input.headerImageFile
      ? sampleImageFromFile(input.headerImageFile.data)
      : undefined
    if (!headerSampleImage) await this.assertSampleImage(input.components)

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
     */
    if (headerSampleImage && this.imageStorage) {
      const { url } = await this.imageStorage.store({
        data: headerSampleImage.data,
        contentType: headerSampleImage.contentType,
        scope: { domainId: input.domainId },
      })
      return provider.createTemplate({
        wabaId,
        name: input.name,
        category: input.category,
        language: input.language,
        components: withHeaderImageUrl(input.components, url),
      })
    }

    return provider.createTemplate({
      wabaId,
      name: input.name,
      category: input.category,
      language: input.language,
      components: input.components,
      ...(headerSampleImage ? { headerSampleImage } : {}),
    })
  }

  private validate(input: CreateConnectorTemplateInput): void {
    if (!TEMPLATE_NAME_REGEX.test(input.name)) {
      throw new InvalidTemplateError(
        'Nome do template deve estar em snake_case (apenas a-z, 0-9 e _)',
      )
    }
    if (!VALID_CATEGORIES.includes(input.category)) {
      throw new InvalidTemplateError('Categoria de template inválida')
    }
    if (!input.language.trim()) {
      throw new InvalidTemplateError('Idioma do template é obrigatório')
    }
    const hasBody = input.components.some(c => c.type === 'BODY')
    if (!hasBody) {
      throw new InvalidTemplateError(
        'Template deve conter ao menos um componente BODY',
      )
    }

    const buttons = input.components.find(c => c.type === 'BUTTONS')?.buttons
    const [violation] = validateTemplateButtons(
      Array.isArray(buttons) ? buttons : [],
      input.category,
    )
    if (violation) {
      throw new InvalidTemplateError(buttonViolationMessage(violation))
    }

    const [headerViolation] = validateTemplateHeader(
      input.components,
      input.category,
      { hasFile: Boolean(input.headerImageFile) },
    )
    if (headerViolation) {
      throw new InvalidTemplateHeaderImageError(
        HEADER_VIOLATION_MESSAGES[headerViolation.code],
      )
    }
  }

  /**
   * Baixa a imagem de exemplo antes de chamar o provider: link que a Meta não
   * consegue usar vira erro corrigível aqui, e não `2388215`/`380` depois.
   */
  private async assertSampleImage(
    components: TemplateComponent[],
  ): Promise<void> {
    const imageUrl = headerImageExampleOf(components)
    if (!imageUrl) return

    try {
      await this.sampleImageFetcher.fetch(imageUrl)
    } catch (error) {
      if (error instanceof TemplateSampleImageError) {
        throw new InvalidTemplateHeaderImageError(
          SAMPLE_IMAGE_MESSAGES[error.reason],
        )
      }
      throw error
    }
  }
}

/**
 * O arquivo enviado passa pelas mesmas travas da imagem baixada pelo link: até
 * 5 MB e JPEG/PNG — aqui pela assinatura, porque o tipo do upload é declarado
 * pelo navegador.
 */
function sampleImageFromFile(data: Buffer): TemplateSampleImage {
  if (data.length > TEMPLATE_SAMPLE_IMAGE_MAX_BYTES) {
    throw new InvalidTemplateHeaderImageError(SAMPLE_IMAGE_MESSAGES.too_large)
  }
  const contentType = sniffTemplateImageType(data)
  if (!contentType) {
    throw new InvalidTemplateHeaderImageError(
      SAMPLE_IMAGE_MESSAGES.invalid_type,
    )
  }
  return { data, contentType }
}

/** O cabeçalho de imagem passa a apontar para o arquivo hospedado. */
function withHeaderImageUrl(
  components: TemplateComponent[],
  imageUrl: string,
): TemplateComponent[] {
  return components.map(component =>
    component.type === 'HEADER' && component.format === 'IMAGE'
      ? { ...component, example: { imageUrl } }
      : component,
  )
}

const META_CDN_MESSAGE =
  'Link do WhatsApp/Meta não vale como imagem de exemplo: use o link do próprio arquivo da imagem'

const HEADER_VIOLATION_MESSAGES: Record<
  TemplateHeaderViolation['code'],
  string
> = {
  header_not_allowed: 'Templates de autenticação não aceitam cabeçalho',
  too_many_headers: 'Template aceita no máximo um cabeçalho',
  unsupported_format: 'O cabeçalho do template só pode ser uma imagem',
  example_required: 'Cabeçalho de imagem exige uma imagem de exemplo',
  example_conflict:
    'Envie o arquivo da imagem de exemplo ou informe o link, não os dois',
  file_without_header:
    'Arquivo de imagem enviado sem cabeçalho de imagem no template',
  example_not_https: 'A imagem de exemplo precisa ser uma URL https',
  example_meta_cdn: META_CDN_MESSAGE,
}

const SAMPLE_IMAGE_MESSAGES: Record<TemplateSampleImageFailure, string> = {
  not_https: 'A imagem de exemplo precisa ser uma URL https',
  meta_cdn: META_CDN_MESSAGE,
  private_host: 'A imagem de exemplo precisa estar num endereço público',
  unreachable:
    'Não foi possível baixar a imagem de exemplo: confira se o link é público e aponta direto para o arquivo',
  too_large: 'A imagem de exemplo passa de 5 MB',
  invalid_type: 'A imagem de exemplo precisa ser um arquivo JPEG ou PNG',
}

const BUTTON_VIOLATION_MESSAGES: Record<
  TemplateButtonViolation['code'],
  string
> = {
  buttons_not_allowed: 'Templates de autenticação não aceitam botões',
  copy_code_not_allowed:
    'Botão de copiar código só é permitido em templates de marketing',
  too_many_buttons: `Template aceita no máximo ${TEMPLATE_BUTTON_LIMITS.total} botões`,
  too_many_of_type: `Template aceita no máximo ${TEMPLATE_BUTTON_LIMITS.URL} botões de link, ${TEMPLATE_BUTTON_LIMITS.PHONE_NUMBER} de ligação e ${TEMPLATE_BUTTON_LIMITS.COPY_CODE} de copiar código`,
  unsupported_type: 'Tipo de botão não suportado',
  text_required: 'Texto do botão é obrigatório',
  text_too_long: `Texto do botão deve ter até ${TEMPLATE_BUTTON_LIMITS.textLength} caracteres`,
  url_required: 'URL do botão é obrigatória',
  url_too_long: `URL do botão deve ter até ${TEMPLATE_BUTTON_LIMITS.urlLength} caracteres`,
  url_variable_position: 'A variável da URL só pode ser {{1}}, no final da URL',
  url_example_required: 'URL com variável exige uma URL de exemplo completa',
  phone_required: 'Telefone do botão é obrigatório',
  phone_invalid: `Telefone do botão deve ter só dígitos, com código do país, e até ${TEMPLATE_BUTTON_LIMITS.phoneLength} caracteres`,
  code_required: 'Código de exemplo do botão é obrigatório',
  code_too_long: `Código de exemplo deve ter até ${TEMPLATE_BUTTON_LIMITS.codeLength} caracteres`,
}

function buttonViolationMessage(violation: TemplateButtonViolation): string {
  const message = BUTTON_VIOLATION_MESSAGES[violation.code]
  return violation.index === undefined
    ? message
    : `Botão ${violation.index + 1}: ${message}`
}
