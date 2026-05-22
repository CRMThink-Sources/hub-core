import { useCallback, useState } from 'react'
import { axiosThinkzap } from '@/infra/client/axios-thinkzap'
import { extractThinkzapError } from './extract-thinkzap-error'

type GroupMutationBase = {
  connectorId: string
  groupId: string
}

export function useGroupMutations(authTokenKey: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    async (params: GroupMutationBase & { groupName: string }) => {
      return runMutation(async () => {
        const client = axiosThinkzap(authTokenKey)
        return client.patch(
          `/thinkzap/groups/${encodeURIComponent(params.groupId)}/name`,
          {
            connectorId: params.connectorId,
            groupName: params.groupName,
          },
        )
      }, 'Failed to update group name')
    },
    [authTokenKey, runMutation],
  )

  const updateDescription = useCallback(
    async (params: GroupMutationBase & { groupDescription: string }) => {
      return runMutation(async () => {
        const client = axiosThinkzap(authTokenKey)
        return client.patch(
          `/thinkzap/groups/${encodeURIComponent(params.groupId)}/description`,
          {
            connectorId: params.connectorId,
            groupDescription: params.groupDescription,
          },
        )
      }, 'Failed to update group description')
    },
    [authTokenKey, runMutation],
  )

  const updatePhoto = useCallback(
    async (params: GroupMutationBase & { groupPhoto: string }) => {
      return runMutation(async () => {
        const client = axiosThinkzap(authTokenKey)
        return client.patch(
          `/thinkzap/groups/${encodeURIComponent(params.groupId)}/photo`,
          {
            connectorId: params.connectorId,
            groupPhoto: params.groupPhoto,
          },
        )
      }, 'Failed to update group photo')
    },
    [authTokenKey, runMutation],
  )

  const addParticipants = useCallback(
    async (
      params: GroupMutationBase & { autoInvite: boolean; phones: string[] },
    ) => {
      return runMutation(async () => {
        const client = axiosThinkzap(authTokenKey)
        return client.post(
          `/thinkzap/groups/${encodeURIComponent(params.groupId)}/participants`,
          {
            connectorId: params.connectorId,
            autoInvite: params.autoInvite,
            phones: params.phones,
          },
        )
      }, 'Failed to add participants')
    },
    [authTokenKey, runMutation],
  )

  const removeParticipants = useCallback(
    async (params: GroupMutationBase & { phones: string[] }) => {
      return runMutation(async () => {
        const client = axiosThinkzap(authTokenKey)
        return client.delete(
          `/thinkzap/groups/${encodeURIComponent(params.groupId)}/participants`,
          {
            data: {
              connectorId: params.connectorId,
              phones: params.phones,
            },
          },
        )
      }, 'Failed to remove participants')
    },
    [authTokenKey, runMutation],
  )

  const leaveGroup = useCallback(
    async (params: GroupMutationBase) => {
      return runMutation(async () => {
        const client = axiosThinkzap(authTokenKey)
        return client.delete(
          `/thinkzap/groups/${encodeURIComponent(params.groupId)}`,
          { params: { connectorId: params.connectorId } },
        )
      }, 'Failed to leave group')
    },
    [authTokenKey, runMutation],
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
