'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { axiosPortal } from '@/infra/client/axios-portal'

type ThinkzapConnectorItem = {
  id: string
  instanceId: string
  vinculatedChannel: string | null
  messageUpdateEventEnabled: boolean
  messageDeleteEventEnabled: boolean
}

type ConnectorsResponse = {
  connectors: ThinkzapConnectorItem[]
}

type ConnectorSaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved' }
  | { kind: 'error'; message: string }

type SectionState =
  | { kind: 'loading' }
  | { kind: 'ready'; connectors: ThinkzapConnectorItem[] }
  | { kind: 'error'; message: string }

type Props = {
  appId: string
}

export function AdminClientThinkzapConnectorsSection({ appId }: Props) {
  const { t } = useTranslation('admin/app-settings')
  const [state, setState] = useState<SectionState>({ kind: 'loading' })
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [saveStates, setSaveStates] = useState<
    Record<string, ConnectorSaveState>
  >({})

  const loadConnectors = useCallback(async () => {
    try {
      const output = await axiosPortal().get<ConnectorsResponse>(
        `/portal/apps/${appId}/thinkzap-connectors`,
      )
      setState({ kind: 'ready', connectors: output.connectors })
    } catch {
      setState({
        kind: 'error',
        message: t('connectorsErrorGeneric'),
      })
    }
  }, [appId, t])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setState({ kind: 'loading' })
      try {
        const output = await axiosPortal().get<ConnectorsResponse>(
          `/portal/apps/${appId}/thinkzap-connectors`,
        )
        if (!cancelled) {
          setState({ kind: 'ready', connectors: output.connectors })
        }
      } catch {
        if (!cancelled) {
          setState({ kind: 'error', message: t('connectorsErrorGeneric') })
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
    await loadConnectors()
    setIsRefreshing(false)
  }

  async function handleToggle(
    connectorId: string,
    field: 'messageUpdateEventEnabled' | 'messageDeleteEventEnabled',
    value: boolean,
  ) {
    setSaveStates(prev => ({
      ...prev,
      [connectorId]: { kind: 'saving' },
    }))

    try {
      await axiosPortal().patch(
        `/portal/apps/${appId}/thinkzap-connectors/${connectorId}/event-binds`,
        { [field]: value },
      )

      setState(prev => {
        if (prev.kind !== 'ready') return prev
        return {
          kind: 'ready',
          connectors: prev.connectors.map(c =>
            c.id === connectorId ? { ...c, [field]: value } : c,
          ),
        }
      })

      setSaveStates(prev => ({ ...prev, [connectorId]: { kind: 'saved' } }))
      setTimeout(() => {
        setSaveStates(prev => {
          const next = { ...prev }
          if (next[connectorId]?.kind === 'saved') {
            delete next[connectorId]
          }
          return next
        })
      }, 2000)
    } catch {
      setSaveStates(prev => ({
        ...prev,
        [connectorId]: {
          kind: 'error',
          message: t('connectorsErrorSave'),
        },
      }))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-foreground">
            {t('connectorsTitle')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('connectorsDescription')}
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
          {t('connectorsRefresh')}
        </Button>
      </div>

      <div className="admin-card p-6">
        {state.kind === 'loading' ? (
          <p className="text-sm text-muted-foreground">
            {t('connectorsLoading')}
          </p>
        ) : null}

        {state.kind === 'error' ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {state.message}
          </p>
        ) : null}

        {state.kind === 'ready' && state.connectors.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('connectorsEmpty')}
          </p>
        ) : null}

        {state.kind === 'ready' && state.connectors.length > 0 ? (
          <div className="space-y-6">
            {state.connectors.map(connector => {
              const save = saveStates[connector.id]
              return (
                <div
                  key={connector.id}
                  className="rounded-lg border border-border p-4"
                >
                  <div className="mb-4">
                    <p className="text-sm font-medium text-foreground">
                      {connector.vinculatedChannel ?? connector.instanceId}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                      {connector.instanceId}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={connector.messageUpdateEventEnabled}
                        onChange={e => {
                          void handleToggle(
                            connector.id,
                            'messageUpdateEventEnabled',
                            e.target.checked,
                          )
                        }}
                        disabled={save?.kind === 'saving'}
                        className="mt-0.5"
                      />
                      <span className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-foreground">
                          {t('connectorsMessageUpdateEvent')}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {t('connectorsMessageUpdateEventHint')}
                        </span>
                      </span>
                    </label>

                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={connector.messageDeleteEventEnabled}
                        onChange={e => {
                          void handleToggle(
                            connector.id,
                            'messageDeleteEventEnabled',
                            e.target.checked,
                          )
                        }}
                        disabled={save?.kind === 'saving'}
                        className="mt-0.5"
                      />
                      <span className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-foreground">
                          {t('connectorsMessageDeleteEvent')}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {t('connectorsMessageDeleteEventHint')}
                        </span>
                      </span>
                    </label>
                  </div>

                  {save?.kind === 'saving' ? (
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="size-3 animate-spin" />
                      {t('connectorsSaving')}
                    </p>
                  ) : null}

                  {save?.kind === 'saved' ? (
                    <p className="mt-3 text-xs text-green-600 dark:text-green-400">
                      {t('connectorsSaved')}
                    </p>
                  ) : null}

                  {save?.kind === 'error' ? (
                    <p className="mt-3 rounded-md bg-red-50 px-2 py-1 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
                      {save.message}
                    </p>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : null}
      </div>
    </div>
  )
}
