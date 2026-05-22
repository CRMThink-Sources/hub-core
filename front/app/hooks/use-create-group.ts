import { useCallback, useState } from 'react'
import { axiosThinkzap } from '@/infra/client/axios-thinkzap'

export type CreatedGroup = {
  phone: string
  invitationLink: string
}

export function useCreateGroup(authTokenKey: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createGroup = useCallback(
    async (params: {
      connectorId: string
      groupName: string
      autoInvite: boolean
      phones: string[]
    }): Promise<CreatedGroup | null> => {
      setLoading(true)
      setError(null)
      try {
        const client = axiosThinkzap(authTokenKey)
        const result = (await client.post(
          '/thinkzap/groups',
          params,
        )) as CreatedGroup
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
          const data = (err.response as { data: unknown }).data
          if (data && typeof data === 'object' && 'result' in data) {
            const result = (data as { result: unknown }).result
            if (
              result &&
              typeof result === 'object' &&
              'error' in result &&
              typeof (result as { error: unknown }).error === 'string'
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
    [authTokenKey],
  )

  return { createGroup, loading, error, setError }
}
