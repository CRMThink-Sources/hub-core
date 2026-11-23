import type { ICrmItemFieldsResponse } from '@/shared/infra/clients/bitrix.client'
import type { VariableSource } from '@/modules/thinkzap/domain/template-variable-mapping'

/** Descrição de um campo em `crm.item.fields`. */
export type CrmFieldMeta = ICrmItemFieldsResponse['result']['fields'][string]

/**
 * Tipos de campo que viram texto útil no corpo de uma mensagem. Ficam de fora
 * arquivo, endereço, responsável, etapa e vínculos: o valor cru é um código ou um
 * objeto, e o rótulo exigiria outra consulta — melhor não oferecer o campo do que
 * preencher a variável com um código que o contato não entende.
 */
const SUPPORTED_TYPES = new Set([
  'string',
  'text',
  'integer',
  'double',
  'boolean',
  'char',
  'date',
  'datetime',
  'enumeration',
  'money',
  'url',
  'crm_multifield',
])

export function isSupportedFieldType(type: string | undefined): boolean {
  return type !== undefined && SUPPORTED_TYPES.has(type)
}

export type CatalogField = {
  source: VariableSource
  /** Chave de `crm.item.get`/`crm.item.fields`. */
  id: string
  title: string
  type: string
  multiple: boolean
  /** Campo personalizado (`ufCrm...`): o seletor ordena depois dos padrão. */
  custom: boolean
}

/** Lista legível dos campos de uma origem, só os de tipo suportado. */
export function toCatalogFields(
  source: VariableSource,
  fields: Record<string, CrmFieldMeta>,
): CatalogField[] {
  return Object.entries(fields)
    .filter(([, field]) => isSupportedFieldType(field.type))
    .map(([id, field]) => ({
      source,
      id,
      title: field.title?.trim() || field.formLabel?.trim() || id,
      type: field.type as string,
      multiple: field.isMultiple === true,
      custom: /^uf/i.test(id),
    }))
    .sort((a, b) =>
      a.custom === b.custom
        ? a.title.localeCompare(b.title, 'pt-BR')
        : a.custom
          ? 1
          : -1,
    )
}
