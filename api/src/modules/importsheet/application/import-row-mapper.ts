import type { ImportConfigMapping } from '../domain/entities/import'
import {
  normalizeBrazilianDoc,
  transformFieldValue,
  type BitrixFieldMeta,
  type FieldParam,
  type StatusLists,
} from './field-value-transform'

export type RowIdentifier = {
  fieldName: string
  value: string
}

export type MappedRow = {
  /** Parâmetros prontos do Bitrix (path + value). */
  params: FieldParam[]
  /** Valores dos campos identificadores (pra dedup/upsert). */
  identifiers: RowIdentifier[]
}

function cell(values: string[], index: number): string {
  return (values[index] ?? '').trim()
}

/**
 * Linha "vazia" = fim dos dados. Com identificador, basta a(s) coluna(s)
 * identificadora(s) estarem em branco; sem identificador, todas as mapeadas.
 */
export function isRowEmpty(
  values: string[],
  mappings: ImportConfigMapping[],
): boolean {
  const identifiers = mappings.filter(m => m.isIdentifier)
  const check = identifiers.length > 0 ? identifiers : mappings
  return check.every(m => cell(values, m.columnIndex) === '')
}

export function mapRow(
  values: string[],
  mappings: ImportConfigMapping[],
  metas: Map<string, BitrixFieldMeta>,
  statusLists: StatusLists,
): MappedRow {
  const params: FieldParam[] = []
  const identifiers: RowIdentifier[] = []

  for (const mapping of mappings) {
    const raw = cell(values, mapping.columnIndex)
    if (mapping.isIdentifier && raw !== '') {
      // Mesmo normalize do campo escrito → busca de dedup casa o formato armazenado.
      identifiers.push({
        fieldName: mapping.fieldName,
        value: normalizeBrazilianDoc(raw),
      })
    }
    params.push(
      ...transformFieldValue(
        mapping.fieldName,
        metas.get(mapping.fieldName),
        raw,
        statusLists,
      ),
    )
  }

  return { params, identifiers }
}
