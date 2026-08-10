import type { ImportConfigMapping } from '../domain/entities/import'
import {
  MULTIFIELD_SENTINEL,
  normalizeBrazilianDoc,
  transformFieldValue,
  type BitrixFieldMeta,
  type FieldParam,
  type OnFieldSkip,
  type StatusLists,
} from './field-value-transform'

/**
 * Expande os params marcados como multifield (PHONE/EMAIL) para o formato do
 * crm.item: `fields[fm][i][typeId|value|valueType]`, com índice `i` único na linha
 * (sequencial entre todos os PHONE/EMAIL). Params não-multifield passam intactos.
 */
function expandMultifields(params: FieldParam[]): FieldParam[] {
  const out: FieldParam[] = []
  let fmIndex = 0
  for (const p of params) {
    if (p.path[0] !== MULTIFIELD_SENTINEL) {
      out.push(p)
      continue
    }
    const i = String(fmIndex++)
    const typeId = p.path[1] ?? 'PHONE'
    out.push({ path: ['fm', i, 'typeId'], value: typeId })
    out.push({ path: ['fm', i, 'value'], value: p.value })
    out.push({ path: ['fm', i, 'valueType'], value: 'WORK' })
  }
  return out
}

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
  onSkip?: OnFieldSkip,
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
        onSkip,
      ),
    )
  }

  return { params: expandMultifields(params), identifiers }
}
