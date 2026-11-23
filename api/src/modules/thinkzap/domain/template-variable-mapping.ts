/**
 * Variáveis padrão do envio de um template: de qual campo do Bitrix sai o valor
 * inicial de cada variável do corpo.
 *
 * O valor é só uma sugestão — o widget preenche e o operador pode editar antes de
 * enviar. Por isso nada aqui entra no envio, na fila ou no provider.
 */

/** De qual registro o campo é lido: o da entidade aberta ou um vinculado a ela. */
export type VariableSource = 'self' | 'contact' | 'company'

export type VariableFieldRef = {
  source: VariableSource
  /**
   * Chave do campo em `crm.item.fields`/`crm.item.get` (camelCase: `title`,
   * `opportunity`, `ufCrm_1712345678`). A mesma chave nos dois métodos é o que faz o
   * catálogo de campos e a leitura do registro nunca divergirem.
   */
  fieldId: string
}

/** Chave: a variável do corpo (`1`, `nome`). Variável sem campo não tem chave. */
export type VariableMappings = Record<string, VariableFieldRef>

export const ENTITY_TYPE_ID_LEAD = 1
export const ENTITY_TYPE_ID_DEAL = 2
export const ENTITY_TYPE_ID_CONTACT = 3
export const ENTITY_TYPE_ID_COMPANY = 4

/**
 * Registros de onde um mapeamento pode ler, por tipo de entidade.
 *
 * Lead, Negócio e SPA enxergam o Contato e a Empresa vinculados; o Contato enxerga a
 * Empresa; a Empresa só a si mesma. Toda entidade que não é Contato nem Empresa (SPA
 * inclusive) tem os dois vínculos.
 */
export function allowedVariableSources(entityTypeId: number): VariableSource[] {
  if (entityTypeId === ENTITY_TYPE_ID_COMPANY) return ['self']
  if (entityTypeId === ENTITY_TYPE_ID_CONTACT) return ['self', 'company']
  return ['self', 'contact', 'company']
}

/**
 * Variável sem `fieldId` é variável **não mapeada**: sai daqui sem chave, para que
 * "todas sem campo" resulte em mapeamento vazio.
 */
export function normalizeVariableMappings(
  mappings: Record<string, VariableFieldRef>,
): VariableMappings {
  const result: VariableMappings = {}
  for (const [key, ref] of Object.entries(mappings)) {
    const fieldId = ref.fieldId.trim()
    if (fieldId) result[key] = { source: ref.source, fieldId }
  }
  return result
}

const DYNAMIC_ENTITY = /^DYNAMIC_(\d+)$/i

/**
 * O `entityTypeId` do tipo de entidade que o widget manda (`deal`, `contact`,
 * `DYNAMIC_1060`...), ou `null` se não for um tipo que conhecemos.
 */
export function entityTypeIdFromWidgetEntity(entity: string): number | null {
  switch (entity.toLowerCase()) {
    case 'lead':
      return ENTITY_TYPE_ID_LEAD
    case 'deal':
      return ENTITY_TYPE_ID_DEAL
    case 'contact':
      return ENTITY_TYPE_ID_CONTACT
    case 'company':
      return ENTITY_TYPE_ID_COMPANY
  }
  const dynamic = DYNAMIC_ENTITY.exec(entity)
  return dynamic?.[1] ? Number(dynamic[1]) : null
}
