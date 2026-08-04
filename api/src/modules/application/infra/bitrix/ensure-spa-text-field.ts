import { BitrixClient } from '@/shared/infra/clients/bitrix.client'

/**
 * Verificação de pré-requisito para campo de **texto** numa SPA.
 *
 * Duas armadilhas do Bitrix, com o mesmo sintoma:
 *
 * 1. `crm.item.update` aceita campo **desconhecido** e responde sucesso,
 *    descartando o valor.
 * 2. Campo criado como **lista** devolve o id de enum gerado pelo portal, não o
 *    valor — então uma leitura literal nunca reconhece nada.
 *
 * Nos dois casos a escrita "funciona", a leitura resolve o default, e não há erro
 * nem log em lugar nenhum. Por isso a verificação existe, e por isso ela reprova
 * `enumeration` em vez de só checar existência.
 *
 * Centralizado porque a segunda armadilha é a que se esquece: duplicar a checagem
 * por campo garante que uma das cópias vai ficar só com a primeira.
 */

const ENUMERATION_FIELD_TYPE = 'enumeration'

export class SpaTextFieldMissingError extends Error {
  constructor(field: string, entityTypeId: number, hint: string) {
    super(
      `Campo "${field}" não existe na SPA ${entityTypeId}. Crie-o como texto antes ` +
        `de gravar — sem ele toda gravação é perdida em silêncio. ${hint}`,
    )
    this.name = 'SpaTextFieldMissingError'
  }
}

export class SpaTextFieldIsEnumerationError extends Error {
  constructor(field: string, entityTypeId: number) {
    super(
      `Campo "${field}" existe na SPA ${entityTypeId} mas é do tipo lista. Campo de ` +
        'lista devolve o id de enum, não o valor, então a leitura nunca reconhece o ' +
        'que foi gravado. Recrie-o como texto.',
    )
    this.name = 'SpaTextFieldIsEnumerationError'
  }
}

export async function ensureSpaTextField(input: {
  bitrix: BitrixClient
  entityTypeId: number
  field: string
  /** O que a ausência do campo quebra, na mensagem de erro. */
  hint: string
}): Promise<void> {
  const response = await input.bitrix.getCrmItemFields(input.entityTypeId)
  const fields = response.result?.fields ?? {}

  const field = fields[input.field]

  if (!field) {
    throw new SpaTextFieldMissingError(
      input.field,
      input.entityTypeId,
      input.hint,
    )
  }

  if (field.type === ENUMERATION_FIELD_TYPE) {
    throw new SpaTextFieldIsEnumerationError(input.field, input.entityTypeId)
  }
}
