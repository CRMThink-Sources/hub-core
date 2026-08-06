import { useCallback, useState } from 'react'
import { axiosThinkzap } from '@/infra/client/axios-thinkzap'
import { APP_CODES } from '@/shared/app/app-codes'
import { appTokenKey } from '@/shared/auth/app-token-storage'
import { extractThinkzapError } from './extract-thinkzap-error'
import type { GroupMetadata } from './group-types'

export function useGroupMetadata() {
  const [metadata, setMetadata] = useState<GroupMetadata | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchMetadata = useCallback(async (itemId: string, groupId: string) => {
    setLoading(true)
    setError(null)
    try {
      const client = axiosThinkzap(appTokenKey(APP_CODES.thinkzap))
      const result = await client.get<GroupMetadata>(
        `/thinkzap/lines/${encodeURIComponent(itemId)}/groups/${encodeURIComponent(groupId)}`,
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
  }, [])

  const clearMetadata = useCallback(() => {
    setMetadata(null)
    setError(null)
  }, [])

  return { metadata, loading, error, fetchMetadata, clearMetadata, setError }
}
