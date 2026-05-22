import { useCallback, useState } from 'react'
import { axiosThinkzap } from '@/infra/client/axios-thinkzap'
import { extractThinkzapError } from './extract-thinkzap-error'
import type { GroupListItem } from './group-types'

export function useListGroups(authTokenKey: string) {
  const [groups, setGroups] = useState<GroupListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const pageSize = 20

  const fetchGroups = useCallback(
    async (connectorId: string, targetPage = 1) => {
      setLoading(true)
      setError(null)
      try {
        const client = axiosThinkzap(authTokenKey)
        const result = (await client.get('/thinkzap/groups', {
          params: { connectorId, page: targetPage, pageSize },
        })) as GroupListItem[]
        setGroups(result)
        setPage(targetPage)
        return result
      } catch (err: unknown) {
        setError(extractThinkzapError(err, 'Failed to list groups'))
        setGroups([])
        return []
      } finally {
        setLoading(false)
      }
    },
    [authTokenKey],
  )

  return { groups, loading, error, page, pageSize, fetchGroups, setError }
}
