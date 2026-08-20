/**
 * De qual método REST saem os campos do documento onde a automação está configurada.
 *
 * `bizproc.document.fields` **não existe** — a REST do Bitrix expõe `bizproc.robot.*`,
 * `bizproc.activity.*`, `bizproc.workflow.*` e `bizproc.task.*`, e nada que descreva os
 * campos de um tipo de documento. Chamá-lo devolve `ERROR_METHOD_NOT_FOUND`, o que
 * deixava o seletor de campo permanentemente vazio.
 *
 * O caminho que existe é o da própria entidade: o terceiro elemento do `document_type`
 * identifica o que está sendo automatizado, e cada entidade tem seu método de campos.
 */

/** Campo do documento, já no id que a expressão do Bitrix usa. */
export type DocumentField = {
  id: string
  title: string
  type: string
  multiple: boolean
  /** Campo personalizado (`UF_*`). Ordena depois dos padrão, que é onde se procura. */
  custom: boolean
}

export type FieldsQuery = {
  method: string
  params: Record<string, unknown>
}

/** Entidades clássicas: o método devolve as chaves já em maiúsculo, como o bizproc. */
const LEGACY_FIELD_METHODS: Record<string, string> = {
  LEAD: 'crm.lead.fields',
  DEAL: 'crm.deal.fields',
  CONTACT: 'crm.contact.fields',
  COMPANY: 'crm.company.fields',
}

/**
 * Entidades servidas por `crm.item.fields`, que pede `entityTypeId`.
 *
 * SPA chega como `DYNAMIC_<id>` e o id é o próprio `entityTypeId`; orçamento e fatura
 * inteligente têm ids fixos.
 */
const ITEM_ENTITY_TYPE_IDS: Record<string, number> = {
  QUOTE: 7,
  SMART_INVOICE: 31,
}

/**
 * O método de campos do tipo de documento, ou `null` quando não sabemos consultá-lo.
 *
 * `null` é resultado válido e não erro: o robô é registrado **sem** `FILTER`, então ele
 * aparece também na automação de listas e de tarefas. Lá o seletor de campo fica sem
 * opções e a tela continua utilizável no modo literal — melhor que oferecer ids de
 * campo que não resolvem naquele documento.
 */
export function resolveFieldsQuery(documentType: string[]): FieldsQuery | null {
  const [module, , entity] = documentType

  if (module !== 'crm' || !entity) return null

  const legacyMethod = LEGACY_FIELD_METHODS[entity]
  if (legacyMethod) return { method: legacyMethod, params: {} }

  const entityTypeId = toEntityTypeId(entity)
  if (entityTypeId === null) return null

  /**
   * `useOriginalUfNames` traz o campo personalizado como `UF_CRM_7_1712345678` em vez
   * do `ufCrm7_1712345678` que `crm.item.fields` devolve por padrão. O bizproc só
   * resolve a forma original, e os campos padrão vêm resolvidos por `upperName`.
   */
  return {
    method: 'crm.item.fields',
    params: { entityTypeId, useOriginalUfNames: 'Y' },
  }
}

function toEntityTypeId(entity: string): number | null {
  const fixed = ITEM_ENTITY_TYPE_IDS[entity]
  if (fixed) return fixed

  const dynamic = /^DYNAMIC_(\d+)$/.exec(entity)
  if (dynamic?.[1]) return Number(dynamic[1])

  return null
}

/**
 * Normaliza as duas formas de resposta numa lista só.
 *
 * `crm.<entidade>.fields` devolve o mapa de campos na raiz; `crm.item.fields` o
 * embrulha em `fields`. O id vem de `upperName` quando existe — é o nome de sistema, e
 * é ele que compõe a expressão gravada — e cai na chave do mapa quando não.
 */
export function toDocumentFields(data: unknown): DocumentField[] {
  const map = unwrapFields(data)
  if (!map) return []

  return Object.entries(map)
    .map(([key, raw]) => {
      const field = (raw ?? {}) as Record<string, unknown>
      const id = asText(field.upperName) || key

      return {
        id,
        title: resolveTitle(field, id),
        type: asText(field.type) || asText(field.Type) || 'string',
        multiple: isMultiple(field),
        custom: id.startsWith('UF_'),
      }
    })
    .sort(compareFields)
}

/**
 * O nome legível do campo.
 *
 * Campo personalizado do CRM não traz `title` — traz `formLabel`, `listLabel` e
 * `filterLabel`, e quando `title` existe ele repete o próprio `UF_CRM_…`. Ler só
 * `title` fazia a lista inteira aparecer como id, que é o nome que ninguém reconhece.
 *
 * Rótulo igual ao id não conta como rótulo: cai na próxima opção, e no fim no id, que
 * pelo menos é o que será gravado.
 */
function resolveTitle(field: Record<string, unknown>, id: string): string {
  const candidates = [
    // `Name` é a forma do `document_fields` do placement, que é a fonte preferida.
    field.Name,
    field.formLabel,
    field.listLabel,
    field.filterLabel,
    field.title,
  ]

  for (const candidate of candidates) {
    const label = asText(candidate).trim()
    if (label && label !== id) return label
  }

  return id
}

/**
 * Padrão antes de personalizado, e alfabético dentro de cada grupo.
 *
 * Ordenar só por título afundava `ID`, `TITLE` e companhia no meio de dezenas de
 * campos personalizados — e são os padrão que se procura primeiro.
 */
function compareFields(a: DocumentField, b: DocumentField): number {
  if (a.custom !== b.custom) return a.custom ? 1 : -1

  return a.title.localeCompare(b.title)
}

/**
 * Filtra os campos pela busca digitada.
 *
 * Casa no rótulo **e** no id: quem conhece o campo pelo `UF_CRM_…` procura por ele, e
 * quem não conhece procura pelo nome. Termos separados por espaço são todos exigidos —
 * "id neg" acha "ID Negócio" sem obrigar a acertar a ordem.
 *
 * Acento e caixa são normalizados: "negocio" acha "Negócio". Entidade com dezenas de
 * campos personalizados é o caso comum, e digitar acento certo não deveria ser
 * requisito para achar o próprio campo.
 */
export function filterFields(
  fields: DocumentField[],
  query: string,
): DocumentField[] {
  const terms = normalizeForSearch(query).split(/\s+/).filter(Boolean)
  if (terms.length === 0) return fields

  return fields.filter(field => {
    const haystack = `${normalizeForSearch(field.title)} ${normalizeForSearch(field.id)}`

    return terms.every(term => haystack.includes(term))
  })
}

function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

function unwrapFields(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null

  const root = data as Record<string, unknown>
  const nested = root.fields

  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as Record<string, unknown>
  }

  return root
}

/** `isMultiple` no CRM, `Multiple: 'Y'` no `document_fields` do placement. */
function isMultiple(field: Record<string, unknown>): boolean {
  return (
    field.isMultiple === true ||
    field.isMultiple === 'Y' ||
    field.Multiple === true ||
    field.Multiple === 'Y'
  )
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}
