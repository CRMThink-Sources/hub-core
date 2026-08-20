import { useCallback, useState } from 'react'
import { axiosThinkzap } from '@/infra/client/axios-thinkzap'
import { APP_CODES } from '@/shared/app/app-codes'
import { appTokenKey } from '@/shared/auth/app-token-storage'
import { extractThinkzapError } from './extract-thinkzap-error'
import type { GroupListItem } from './group-types'

type ListGroupsResponse = {
  items: GroupListItem[]
  hasNextPage: boolean
}

/**
 * Normaliza o corpo antes de virar estado.
 *
 * `GruposLista` tipa `groups` como array obrigatório, então qualquer coisa que
 * não seja lista derruba o render em `groups.length`. Um corpo fora do formato —
 * api de versão anterior servindo o array cru, resposta truncada — vira lista
 * vazia em vez de crash. O array cru é aceito de propósito: api e front sobem em
 * deploys separados, e durante a janela entre eles a tela continua de pé.
 */
function toListGroupsResponse(body: unknown): ListGroupsResponse {
  if (Array.isArray(body)) {
    return { items: body as GroupListItem[], hasNextPage: false }
  }

  const items = (body as ListGroupsResponse | null)?.items
  return {
    items: Array.isArray(items) ? items : [],
    hasNextPage: (body as ListGroupsResponse | null)?.hasNextPage === true,
  }
}

/** Grupos da linha. `itemId` é o item de assinatura, no path do recurso. */
export function useListGroups() {
  const [groups, setGroups] = useState<GroupListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  /**
   * Vem do servidor, não de `groups.length`: a Z-API pagina conversas e o filtro
   * de grupos roda depois, então o tamanho da lista não diz nada sobre haver
   * página seguinte.
   */
  const [hasNextPage, setHasNextPage] = useState(false)
  const pageSize = 20

  const fetchGroups = useCallback(async (itemId: string, targetPage = 1) => {
    setLoading(true)
    setError(null)
    try {
      const client = axiosThinkzap(appTokenKey(APP_CODES.thinkzap))
      const body = await client.get<unknown>(
        `/thinkzap/lines/${encodeURIComponent(itemId)}/groups`,
        { params: { page: targetPage, pageSize } },
      )
      const result = toListGroupsResponse(body)
      setGroups(result.items)
      setHasNextPage(result.hasNextPage)
      setPage(targetPage)
      return result.items
    } catch (err: unknown) {
      setError(extractThinkzapError(err, 'Failed to list groups'))
      setGroups([])
      setHasNextPage(false)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    groups,
    loading,
    error,
    page,
    pageSize,
    hasNextPage,
    fetchGroups,
    setError,
  }
}
