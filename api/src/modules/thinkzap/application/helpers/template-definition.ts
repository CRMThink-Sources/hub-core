import {
  TemplateCategory,
  TemplateComponent,
} from '@/modules/thinkzap/domain/ports/whatsapp-template-provider.port'
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

/**
 * Regras de definição de template compartilhadas por criação e edição, e as
 * travas de imagem compartilhadas também pela imagem padrão do envio.
 */

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

export type TemplateDefinition = {
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

/** Nome, categoria, idioma, corpo, botões e cabeçalho — sem rede. */
export function validateTemplateDefinition(input: TemplateDefinition): void {
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

/** Quem é a imagem nas mensagens de erro: a amostra do cadastro ou a padrão do envio. */
export type TemplateImageRole = 'sample' | 'default'

/**
 * Baixa a imagem de exemplo antes de chamar o provider: link que a Meta não
 * consegue usar vira erro corrigível aqui, e não `2388215`/`380` depois.
 */
export async function assertSampleImage(
  fetcher: TemplateSampleImageFetcher,
  components: TemplateComponent[],
): Promise<void> {
  const imageUrl = headerImageExampleOf(components)
  if (imageUrl) await assertImageUrl(fetcher, imageUrl, 'sample')
}

/** Mesmas travas do download da amostra, para qualquer link de imagem. */
export async function assertImageUrl(
  fetcher: TemplateSampleImageFetcher,
  imageUrl: string,
  role: TemplateImageRole,
): Promise<void> {
  try {
    await fetcher.fetch(imageUrl)
  } catch (error) {
    if (error instanceof TemplateSampleImageError) {
      throw new InvalidTemplateHeaderImageError(
        IMAGE_MESSAGES[role][error.reason],
      )
    }
    throw error
  }
}

/**
 * O arquivo enviado passa pelas mesmas travas da imagem baixada pelo link: até
 * 5 MB e JPEG/PNG — aqui pela assinatura, porque o tipo do upload é declarado
 * pelo navegador.
 */
export function imageFromFile(
  data: Buffer,
  role: TemplateImageRole = 'sample',
): TemplateSampleImage {
  if (data.length > TEMPLATE_SAMPLE_IMAGE_MAX_BYTES) {
    throw new InvalidTemplateHeaderImageError(IMAGE_MESSAGES[role].too_large)
  }
  const contentType = sniffTemplateImageType(data)
  if (!contentType) {
    throw new InvalidTemplateHeaderImageError(IMAGE_MESSAGES[role].invalid_type)
  }
  return { data, contentType }
}

/** O cabeçalho de imagem passa a apontar para o arquivo hospedado. */
export function withHeaderImageUrl(
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

const IMAGE_MESSAGES: Record<
  TemplateImageRole,
  Record<TemplateSampleImageFailure, string>
> = {
  sample: {
    not_https: 'A imagem de exemplo precisa ser uma URL https',
    meta_cdn: META_CDN_MESSAGE,
    private_host: 'A imagem de exemplo precisa estar num endereço público',
    unreachable:
      'Não foi possível baixar a imagem de exemplo: confira se o link é público e aponta direto para o arquivo',
    too_large: 'A imagem de exemplo passa de 5 MB',
    invalid_type: 'A imagem de exemplo precisa ser um arquivo JPEG ou PNG',
  },
  default: {
    not_https: 'A imagem padrão precisa ser uma URL https',
    meta_cdn:
      'Link do WhatsApp/Meta expira e não vale como imagem padrão: use o link do próprio arquivo da imagem',
    private_host: 'A imagem padrão precisa estar num endereço público',
    unreachable:
      'Não foi possível baixar a imagem padrão: confira se o link é público e aponta direto para o arquivo',
    too_large: 'A imagem padrão passa de 5 MB',
    invalid_type: 'A imagem padrão precisa ser um arquivo JPEG ou PNG',
  },
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
