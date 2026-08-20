import { useCallback, useState } from 'react'
import { axiosThinkzap } from '@/infra/client/axios-thinkzap'
import { APP_CODES } from '@/shared/app/app-codes'
import { appTokenKey } from '@/shared/auth/app-token-storage'
import { extractThinkzapError } from './extract-thinkzap-error'

/**
 * Mutações de grupo, sob o recurso da linha.
 *
 * A linha é o **item de assinatura**: `itemId` vai no path, não `connectorId` no
 * corpo. O backend resolve a credencial Z-API a partir dele, e o escopo sai do JWT.
 */
type GroupMutationBase = {
  itemId: string
  groupId: string
}

const groupPath = (itemId: string, groupId: string): string =>
  `/thinkzap/lines/${encodeURIComponent(itemId)}/groups/${encodeURIComponent(groupId)}`

export function useGroupMutations() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const client = useCallback(
    () => axiosThinkzap(appTokenKey(APP_CODES.thinkzap)),
    [],
  )

  const runMutation = useCallback(
    async <T>(
      fn: () => Promise<T>,
      fallbackError: string,
    ): Promise<T | null> => {
      setLoading(true)
      setError(null)
      try {
        return await fn()
      } catch (err: unknown) {
        setError(extractThinkzapError(err, fallbackError))
        return null
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const updateName = useCallback(
    async (params: GroupMutationBase & { groupName: string }) =>
      runMutation(
        () =>
          client().patch(`${groupPath(params.itemId, params.groupId)}/name`, {
            groupName: params.groupName,
          }),
        'Failed to update group name',
      ),
    [client, runMutation],
  )

  const updateDescription = useCallback(
    async (params: GroupMutationBase & { groupDescription: string }) =>
      runMutation(
        () =>
          client().patch(
            `${groupPath(params.itemId, params.groupId)}/description`,
            { groupDescription: params.groupDescription },
          ),
        'Failed to update group description',
      ),
    [client, runMutation],
  )

  const updatePhoto = useCallback(
    async (params: GroupMutationBase & { groupPhoto: string }) =>
      runMutation(
        () =>
          client().patch(`${groupPath(params.itemId, params.groupId)}/photo`, {
            groupPhoto: params.groupPhoto,
          }),
        'Failed to update group photo',
      ),
    [client, runMutation],
  )

  const addParticipants = useCallback(
    async (
      params: GroupMutationBase & { autoInvite: boolean; phones: string[] },
    ) =>
      runMutation(
        () =>
          client().post(
            `${groupPath(params.itemId, params.groupId)}/participants`,
            { autoInvite: params.autoInvite, phones: params.phones },
          ),
        'Failed to add participants',
      ),
    [client, runMutation],
  )

  const removeParticipants = useCallback(
    async (params: GroupMutationBase & { phones: string[] }) =>
      runMutation(
        () =>
          client().delete(
            `${groupPath(params.itemId, params.groupId)}/participants`,
            { data: { phones: params.phones } },
          ),
        'Failed to remove participants',
      ),
    [client, runMutation],
  )

  const leaveGroup = useCallback(
    async (params: GroupMutationBase) =>
      runMutation(
        () => client().delete(groupPath(params.itemId, params.groupId)),
        'Failed to leave group',
      ),
    [client, runMutation],
  )

  return {
    loading,
    error,
    setError,
    updateName,
    updateDescription,
    updatePhoto,
    addParticipants,
    removeParticipants,
    leaveGroup,
  }
}
