import { TemplateProviderResolver } from '@/modules/thinkzap/domain/ports/template-provider-resolver.port'
import {
  CreatedTemplate,
  TemplateCategory,
  TemplateComponent,
} from '@/modules/thinkzap/domain/ports/whatsapp-template-provider.port'
import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
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
  }
}
