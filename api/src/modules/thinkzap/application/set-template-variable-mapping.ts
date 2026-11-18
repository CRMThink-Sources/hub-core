import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { TemplateProviderResolver } from '@/modules/thinkzap/domain/ports/template-provider-resolver.port'
import { TemplateVariableMappingsRepository } from '@/modules/thinkzap/domain/ports/template-variable-mappings-repository.port'
import { TemplateNotFoundError } from '@/modules/thinkzap/domain/ports/template-errors'
import {
  allowedVariableSources,
  normalizeVariableMappings,
  type VariableFieldRef,
  type VariableMappings,
} from '@/modules/thinkzap/domain/template-variable-mapping'
import { extractTemplateVariableKeys } from './helpers/resolve-template-body'
import {
  resolveTemplateContext,
  type ResolveTemplateContextInput,
} from './helpers/resolve-template-context'
import { InvalidTemplateError } from './helpers/template-definition'

export type SetTemplateVariableMappingInput = ResolveTemplateContextInput & {
  name: string
  language: string
  entityTypeId: number
  mappings: Record<string, VariableFieldRef>
}

/**
 * Define as variáveis padrão de um template para um tipo de entidade: de qual campo
 * do Bitrix sai o valor inicial de cada variável do corpo.
 *
 * Substitui o mapeamento anterior do mesmo tipo. Todas as variáveis sem campo apagam
 * o registro — "sem mapeamento" tem uma representação só.
 *
 * Vale também para template criado direto na Meta: o template é conferido na lista
 * ao vivo, que é a mesma fonte do catálogo de envio.
 */
export class SetTemplateVariableMappingUseCase {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly templateProviderResolver: TemplateProviderResolver,
    private readonly mappingsRepository: TemplateVariableMappingsRepository,
  ) {}

  async execute(
    input: SetTemplateVariableMappingInput,
  ): Promise<{ mappings: VariableMappings }> {
    const mappings = normalizeVariableMappings(input.mappings)

    // Recusas que não dependem do provider vêm antes dele.
    const allowed = allowedVariableSources(input.entityTypeId)
    for (const [key, ref] of Object.entries(mappings)) {
      if (!allowed.includes(ref.source)) {
        throw new InvalidTemplateError(
          `A variável "${key}" lê de um registro que este tipo de entidade não tem vinculado. Escolha um campo da própria entidade ou de um vínculo disponível.`,
        )
      }
    }

    // Gravação local, mas linha bloqueada também recusa: é escrita do cliente.
    const { wabaId, provider } = await resolveTemplateContext(
      input,
      {
        getAplicationContext: this.getAplicationContext,
        templateProviderResolver: this.templateProviderResolver,
      },
      { requireEnabled: true },
    )

    const template = (await provider.listTemplates(wabaId)).find(
      t => t.name === input.name && t.language === input.language,
    )
    if (!template) {
      throw new TemplateNotFoundError(`${input.name} (${input.language})`)
    }

    const body = template.components.find(c => c.type === 'BODY')
    const keys = extractTemplateVariableKeys(
      typeof body?.text === 'string' ? body.text : '',
    )
    for (const key of Object.keys(mappings)) {
      if (!keys.includes(key)) {
        throw new InvalidTemplateError(
          `O template não tem a variável "${key}". Atualize a tela e tente de novo.`,
        )
      }
    }

    const scope = {
      domainId: input.domainId,
      subscriptionItemId: input.subscriptionItemId,
    }
    const key = { name: input.name, language: input.language }

    if (Object.keys(mappings).length === 0) {
      await this.mappingsRepository.delete(scope, key, input.entityTypeId)
    } else {
      await this.mappingsRepository.upsert(
        scope,
        key,
        input.entityTypeId,
        mappings,
      )
    }
    return { mappings }
  }
}
