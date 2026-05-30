'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { axiosPortal } from '@/infra/client/axios-portal'

type InstalledPlacement = {
  placement: string
  handler: string
  title: string | null
  isThinkzap: boolean
}

type PlacementsResponse = {
  placements: InstalledPlacement[]
}

type SectionState =
  | { kind: 'loading' }
  | { kind: 'ready'; placements: InstalledPlacement[] }
  | { kind: 'error'; message: string }

import { resolveListApiError } from './admin-deployment.helpers'

function truncateHandler(handler: string, max = 48): string {
  if (handler.length <= max) return handler
  return `${handler.slice(0, max - 1)}…`
}

type Props = {
  appId: string
}

export function AdminClientPlacementsSection({ appId }: Props) {
  const { t } = useTranslation('admin/app-settings')
  const [state, setState] = useState<SectionState>({ kind: 'loading' })
  const [isRefreshing, setIsRefreshing] = useState(false)

  const loadPlacements = useCallback(async () => {
    try {
      const output = await axiosPortal().get<PlacementsResponse>(
        `/portal/apps/${appId}/placements`,
      )
      setState({ kind: 'ready', placements: output.placements })
    } catch (err) {
      setState({
        kind: 'error',
        message: resolveListApiError(err, t, 'placements'),
      })
    }
  }, [appId, t])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setState({ kind: 'loading' })
      try {
        const output = await axiosPortal().get<PlacementsResponse>(
          `/portal/apps/${appId}/placements`,
        )
        if (!cancelled) {
          setState({ kind: 'ready', placements: output.placements })
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            kind: 'error',
            message: resolveListApiError(err, t, 'placements'),
          })
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
    await loadPlacements()
    setIsRefreshing(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-foreground">
            {t('placementsTitle')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('placementsDescription')}
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
          {t('placementsRefresh')}
        </Button>
      </div>

      <div className="admin-card p-6">
        {state.kind === 'loading' ? (
          <p className="text-sm text-muted-foreground">
            {t('placementsLoading')}
          </p>
        ) : null}

        {state.kind === 'error' ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {state.message}
          </p>
        ) : null}

        {state.kind === 'ready' && state.placements.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('placementsEmpty')}
          </p>
        ) : null}

        {state.kind === 'ready' && state.placements.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-border bg-background">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">
                    {t('placementsColumnPlacement')}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t('placementsColumnTitle')}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t('placementsColumnHandler')}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t('placementsColumnApp')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {state.placements.map(item => (
                  <tr
                    key={`${item.placement}:${item.handler}`}
                    className="border-b border-border last:border-b-0"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-foreground">
                      {item.placement}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {item.title ?? '—'}
                    </td>
                    <td
                      className="max-w-xs truncate px-4 py-3 font-mono text-xs text-muted-foreground"
                      title={item.handler}
                    >
                      {truncateHandler(item.handler)}
                    </td>
                    <td className="px-4 py-3">
                      {item.isThinkzap ? (
                        <span className="inline-flex rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          {t('placementsBadgeThinkzap')}
                        </span>
                      ) : (
                        <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          {t('placementsBadgeOther')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  )
}
