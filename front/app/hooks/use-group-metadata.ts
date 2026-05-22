import { useCallback, useState } from 'react'
import { axiosThinkzap } from '@/infra/client/axios-thinkzap'
import { extractThinkzapError } from './extract-thinkzap-error'
import type { GroupMetadata } from './group-types'

export function useGroupMetadata(authTokenKey: string) {
  const [metadata, setMetadata] = useState<GroupMetadata | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchMetadata = useCallback(
    async (connectorId: string, groupId: string) => {
      setLoading(true)
      setError(null)
      try {
        const client = axiosThinkzap(authTokenKey)
        const result = await client.get<GroupMetadata>(
          `/thinkzap/groups/${encodeURIComponent(groupId)}`,
          { params: { connectorId } },
        )
        setMetadata(result)
        return result
      } catch (err: unknown) {
        setError(extractThinkzapError(err, 'Failed to load group'))
        setMetadata(null)
        return null
      } finally {
        setLoading(false)
      }
    },
    [authTokenKey],
  )

  const clearMetadata = useCallback(() => {
    setMetadata(null)
    setError(null)
  }, [])

  return { metadata, loading, error, fetchMetadata, clearMetadata, setError }
}
