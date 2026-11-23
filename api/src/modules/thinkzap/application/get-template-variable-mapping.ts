import { TemplateVariableMappingsRepository } from '@/modules/thinkzap/domain/ports/template-variable-mappings-repository.port'
import type { VariableMappings } from '@/modules/thinkzap/domain/template-variable-mapping'

export type GetTemplateVariableMappingInput = {
  domainId: string
  /** Id do item de assinatura — a linha. */
  subscriptionItemId: string
  name: string
  language: string
  entityTypeId: number
}

/**
 * O mapeamento salvo de um template para um tipo de entidade, ou vazio.
 *
 * Só lê o que é nosso, escopado pelo `domainId` do JWT: não consulta o provider, que
 * é uma ida à Meta que a leitura não precisa.
 */
export class GetTemplateVariableMappingUseCase {
  constructor(
    private readonly mappingsRepository: TemplateVariableMappingsRepository,
  ) {}

  async execute(
    input: GetTemplateVariableMappingInput,
  ): Promise<{ mappings: VariableMappings }> {
    const mappings = await this.mappingsRepository.find(
      {
        domainId: input.domainId,
        subscriptionItemId: input.subscriptionItemId,
      },
      { name: input.name, language: input.language },
      input.entityTypeId,
    )
    return { mappings: mappings ?? {} }
  }
}
