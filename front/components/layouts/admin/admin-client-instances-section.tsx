'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { axiosPortal } from '@/infra/client/axios-portal'
import { AdminInstanceConfigModal } from './admin-instance-config-modal'

export type ThinkzapInstanceItem = {
  connectorId: string
  connectorStatus: string
  provider: string
  instanceDbId: string
  instanceId: string
  vinculatedChannel: string | null
  status: string | null
  messageUpdateEventEnabled: boolean
  messageDeleteEventEnabled: boolean
  zapiName: string | null
  zapiConnected: boolean | null
  zapiPaymentStatus: string | null
}

type InstancesResponse = {
  instances: ThinkzapInstanceItem[]
}

type SectionState =
  | { kind: 'loading' }
  | { kind: 'ready'; instances: ThinkzapInstanceItem[] }
  | { kind: 'error'; message: string }

type Props = {
  appId: string
}

export function AdminClientInstancesSection({ appId }: Props) {
  const { t } = useTranslation('admin/app-settings')
  const [state, setState] = useState<SectionState>({ kind: 'loading' })
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedInstance, setSelectedInstance] =
    useState<ThinkzapInstanceItem | null>(null)

  const loadInstances = useCallback(async () => {
    try {
      const output = await axiosPortal().get<InstancesResponse>(
        `/portal/apps/${appId}/thinkzap-instances`,
      )
      setState({ kind: 'ready', instances: output.instances })
    } catch {
      setState({ kind: 'error', message: t('instancesErrorGeneric') })
    }
  }, [appId, t])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setState({ kind: 'loading' })
      try {
        const output = await axiosPortal().get<InstancesResponse>(
          `/portal/apps/${appId}/thinkzap-instances`,
        )
        if (!cancelled) {
          setState({ kind: 'ready', instances: output.instances })
        }
      } catch {
        if (!cancelled) {
          setState({ kind: 'error', message: t('instancesErrorGeneric') })
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [appId, t])

  async function handleRefresh() {
    setIsRefreshing(true)
    await loadInstances()
    setIsRefreshing(false)
  }

  function handleInstanceUpdate(updated: Partial<ThinkzapInstanceItem>) {
    setState(prev => {
      if (prev.kind !== 'ready') return prev
      return {
        kind: 'ready',
        instances: prev.instances.map(i =>
          i.instanceDbId === updated.instanceDbId ? { ...i, ...updated } : i,
        ),
      }
    })
    if (
      selectedInstance &&
      updated.instanceDbId === selectedInstance.instanceDbId
    ) {
      setSelectedInstance(prev => (prev ? { ...prev, ...updated } : prev))
    }
  }

  function connectedBadge(connected: boolean | null) {
    if (connected === null)
      return <span className="text-muted-foreground">—</span>
    return connected ? (
      <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
        <span className="size-1.5 rounded-full bg-current" />
        {t('instancesStatusConnected')}
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <span className="size-1.5 rounded-full bg-current" />
        {t('instancesStatusDisconnected')}
      </span>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-foreground">
            {t('instancesTitle')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('instancesDescription')}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void handleRefresh()
          }}
          disabled={state.kind === 'loading' || isRefreshing}
        >
          {isRefreshing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          {t('instancesRefresh')}
        </Button>
      </div>

      <div className="admin-card overflow-hidden">
        {state.kind === 'loading' ? (
          <p className="p-6 text-sm text-muted-foreground">
            {t('instancesLoading')}
          </p>
        ) : null}

        {state.kind === 'error' ? (
          <p className="m-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {state.message}
          </p>
        ) : null}

        {state.kind === 'ready' && state.instances.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            {t('instancesEmpty')}
          </p>
        ) : null}

        {state.kind === 'ready' && state.instances.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t('instancesColumnInstance')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t('instancesColumnProvider')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t('instancesColumnPhone')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t('instancesColumnStatus')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t('instancesColumnSubscription')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {state.instances.map(instance => (
                  <tr
                    key={instance.instanceDbId}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="text-left text-primary underline underline-offset-2 hover:no-underline"
                        onClick={() => setSelectedInstance(instance)}
                      >
                        <span className="flex items-center gap-2 font-medium">
                          {instance.zapiName ?? instance.instanceId}
                          {instance.connectorStatus === 'INACTIVE' ? (
                            <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                              {t('instancesStatusInactive')}
                            </span>
                          ) : null}
                        </span>
                        {instance.zapiName ? (
                          <span className="font-mono text-xs text-muted-foreground">
                            {instance.instanceId}
                          </span>
                        ) : null}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                        {instance.provider === 'HUBMESSAGE'
                          ? t('instancesProviderOfficial')
                          : t('instancesProviderZapi')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {instance.vinculatedChannel ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      {connectedBadge(instance.zapiConnected)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {instance.zapiPaymentStatus ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {selectedInstance ? (
        <AdminInstanceConfigModal
          appId={appId}
          instance={selectedInstance}
          onClose={() => setSelectedInstance(null)}
          onUpdate={handleInstanceUpdate}
        />
      ) : null}
    </div>
  )
}
