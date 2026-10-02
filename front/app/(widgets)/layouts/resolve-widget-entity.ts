export type WidgetEntity = {
  entity: string
  entityId: string
}

const PLACEMENT_TO_ENTITY = {
  CRM_DEAL_DETAIL_TAB: 'deal',
  CRM_CONTACT_DETAIL_TAB: 'contact',
  CRM_COMPANY_DETAIL_TAB: 'company',
  CRM_LEAD_DETAIL_TAB: 'lead',
} as const

/**
 * Aba de item de SPA. O `entityTypeId` é arbitrário (1060, 1142, ...), por isso
 * não cabe no mapa estático acima.
 */
const DYNAMIC_PLACEMENT_PATTERN = /^CRM_DYNAMIC_(\d+)_DETAIL_TAB$/

/**
 * A entidade do CRM em que o widget está aberto, no formato que as rotas de envio
 * esperam.
 *
 * SPA vira `DYNAMIC_<entityTypeId>`, e não `dynamic_<id>`: é o mesmo owner type que
 * os robôs do Bizproc já gravam (`parseBizprocDocumentId`), então outbox, timeline e
 * aviso de falha tratam os dois caminhos igual.
 *
 * `null` quando o placement é desconhecido ou não traz `ID` — quem chama recusa o
 * envio em vez de mandar um request que a API rejeitaria com erro de validação cru.
 */
export function resolveWidgetEntity(
  placement: string | undefined,
  options: { ID?: unknown } | undefined,
): WidgetEntity | null {
  const rawId = options?.ID
  const entityId =
    typeof rawId === 'number' ? String(rawId) : (rawId as string | undefined)
  if (typeof entityId !== 'string' || !entityId.trim() || !placement) {
    return null
  }

  const staticEntity =
    PLACEMENT_TO_ENTITY[placement as keyof typeof PLACEMENT_TO_ENTITY]
  if (staticEntity) return { entity: staticEntity, entityId }

  const dynamicMatch = DYNAMIC_PLACEMENT_PATTERN.exec(placement)
  if (dynamicMatch) return { entity: `DYNAMIC_${dynamicMatch[1]}`, entityId }

  return null
}
