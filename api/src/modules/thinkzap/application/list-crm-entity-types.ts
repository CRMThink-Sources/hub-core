import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import {
  ENTITY_TYPE_ID_COMPANY,
  ENTITY_TYPE_ID_CONTACT,
  ENTITY_TYPE_ID_DEAL,
  ENTITY_TYPE_ID_LEAD,
} from '@/modules/thinkzap/domain/template-variable-mapping'

export type CrmEntityType = {
  entityTypeId: number
  /** Nome da SPA no portal; ausente nas entidades padrão (o front traduz). */
  title?: string
  kind: 'standard' | 'spa'
}

type CrmTypeListResponse = {
  result?: {
    types?: Array<{ entityTypeId?: number; title?: string }>
  }
}

const PAGE_SIZE = 50
/** Teto de páginas: portal com centenas de SPAs não é o caso, e o laço não pode correr solto. */
const MAX_PAGES = 10

const STANDARD: CrmEntityType[] = [
  { entityTypeId: ENTITY_TYPE_ID_LEAD, kind: 'standard' },
  { entityTypeId: ENTITY_TYPE_ID_DEAL, kind: 'standard' },
  { entityTypeId: ENTITY_TYPE_ID_CONTACT, kind: 'standard' },
  { entityTypeId: ENTITY_TYPE_ID_COMPANY, kind: 'standard' },
]

/**
 * Tipos de entidade em que o widget abre — Lead, Negócio, Contato, Empresa e as SPAs
 * do portal —, para o operador escolher a que mapear variáveis.
 *
 * Falha ao listar as SPAs **não** derruba a resposta: as quatro entidades padrão
 * continuam servindo, e o operador que só usa Negócio não fica sem a tela por causa
 * de um erro de listagem de SPA.
 */
export class ListCrmEntityTypesUseCase {
  constructor(private readonly bitrix: Pick<BitrixClient, 'callMethod'>) {}

  async execute(): Promise<CrmEntityType[]> {
    const spas: CrmEntityType[] = []

    try {
      for (let page = 0; page < MAX_PAGES; page++) {
        const response = await this.bitrix.callMethod<CrmTypeListResponse>(
          'crm.type.list',
          { start: page * PAGE_SIZE },
        )
        const types = response?.result?.types ?? []

        for (const type of types) {
          if (typeof type.entityTypeId !== 'number') continue
          spas.push({
            entityTypeId: type.entityTypeId,
            ...(type.title ? { title: type.title } : {}),
            kind: 'spa',
          })
        }
        if (types.length < PAGE_SIZE) break
      }
    } catch {
      // Só as entidades padrão.
    }

    return [...STANDARD, ...spas]
  }
}
