import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import {
  allowedVariableSources,
  ENTITY_TYPE_ID_COMPANY,
  ENTITY_TYPE_ID_CONTACT,
  type VariableSource,
} from '@/modules/thinkzap/domain/template-variable-mapping'
import { toCatalogFields, type CatalogField } from './helpers/crm-field-catalog'

export type ListCrmFieldsInput = { entityTypeId: number }

/**
 * Campos que o operador pode ligar a uma variável, para um tipo de entidade: os da
 * própria entidade e os do Contato e da Empresa vinculados (`allowedVariableSources`).
 *
 * Falha do Bitrix **propaga**: sem a lista o diálogo não tem o que mostrar, e uma
 * lista parcial faria o operador achar que o campo de Contato não existe.
 */
export class ListCrmFieldsUseCase {
  constructor(
    private readonly bitrix: Pick<BitrixClient, 'getCrmItemFields'>,
  ) {}

  async execute(input: ListCrmFieldsInput): Promise<CatalogField[]> {
    const sources = allowedVariableSources(input.entityTypeId)

    const bySource = await Promise.all(
      sources.map(async source => {
        const {
          result: { fields },
        } = await this.bitrix.getCrmItemFields(
          entityTypeIdOf(source, input.entityTypeId),
        )
        return toCatalogFields(source, fields)
      }),
    )

    return bySource.flat()
  }
}

function entityTypeIdOf(source: VariableSource, selfTypeId: number): number {
  if (source === 'contact') return ENTITY_TYPE_ID_CONTACT
  if (source === 'company') return ENTITY_TYPE_ID_COMPANY
  return selfTypeId
}
