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
import { resolveTemplateContext } from './helpers/resolve-template-context'

/** Erro de validação de dados do template antes de submeter ao provider. */
export class InvalidTemplateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidTemplateError'
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
}

/** Cadastra um template de um conector oficial (submete à aprovação da Meta). */
export class CreateConnectorTemplateUseCase {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly templateProviderResolver: TemplateProviderResolver,
  ) {}

  async execute(input: CreateConnectorTemplateInput): Promise<CreatedTemplate> {
    this.validate(input)

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

    return provider.createTemplate({
      wabaId,
      name: input.name,
      category: input.category,
      language: input.language,
      components: input.components,
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
  }
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
