import { useCallback, useState } from 'react'
import { axiosThinkzap } from '@/infra/client/axios-thinkzap'
import { APP_CODES } from '@/shared/app/app-codes'
import { appTokenKey } from '@/shared/auth/app-token-storage'

export type CreatedGroup = {
  phone: string
  invitationLink: string
}

export function useCreateGroup() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createGroup = useCallback(
    async (params: {
      itemId: string
      groupName: string
      autoInvite: boolean
      phones: string[]
    }): Promise<CreatedGroup | null> => {
      setLoading(true)
      setError(null)
      try {
        const client = axiosThinkzap(appTokenKey(APP_CODES.thinkzap))
        const { itemId, ...body } = params
        const result = await client.post<CreatedGroup>(
          `/thinkzap/lines/${encodeURIComponent(itemId)}/groups`,
          body,
        )
        return result
      } catch (err: unknown) {
        let message: string | null = null
        if (
          err &&
          typeof err === 'object' &&
          'response' in err &&
          err.response &&
          typeof err.response === 'object' &&
          'data' in err.response
        ) {
          const data = err.response.data
          if (data && typeof data === 'object' && 'result' in data) {
            const result = data.result
            if (
              result &&
              typeof result === 'object' &&
              'error' in result &&
              typeof result.error === 'string'
            ) {
              message = (result as { error: string }).error
            }
          }
        }
        setError(message ?? 'Failed to create group')
        return null
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  return { createGroup, loading, error, setError }
}
