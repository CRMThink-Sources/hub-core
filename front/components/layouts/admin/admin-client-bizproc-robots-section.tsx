'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { axiosPortal } from '@/infra/client/axios-portal'
import { resolveListApiError } from './admin-deployment.helpers'

type InstalledBizprocRobot = {
  code: string
  name: string | null
  isThinkzap: boolean
}

type BizprocRobotsResponse = {
  robots: InstalledBizprocRobot[]
}

type SectionState =
  | { kind: 'loading' }
  | { kind: 'ready'; robots: InstalledBizprocRobot[] }
  | { kind: 'error'; message: string }

type Props = {
  appId: string
}

export function AdminClientBizprocRobotsSection({ appId }: Props) {
  const { t } = useTranslation('admin/app-settings')
  const keyPrefix = 'bizprocRobots'
  const [state, setState] = useState<SectionState>({ kind: 'loading' })
  const [isRefreshing, setIsRefreshing] = useState(false)

  const loadRobots = useCallback(async () => {
    try {
      const output = await axiosPortal().get<BizprocRobotsResponse>(
        `/portal/apps/${appId}/bizproc-robots`,
      )
      setState({ kind: 'ready', robots: output.robots })
    } catch (err) {
      setState({
        kind: 'error',
        message: resolveListApiError(err, t, keyPrefix),
      })
    }
  }, [appId, t])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setState({ kind: 'loading' })
      try {
        const output = await axiosPortal().get<BizprocRobotsResponse>(
          `/portal/apps/${appId}/bizproc-robots`,
        )
        if (!cancelled) {
          setState({ kind: 'ready', robots: output.robots })
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            kind: 'error',
            message: resolveListApiError(err, t, keyPrefix),
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
    await loadRobots()
    setIsRefreshing(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-foreground">
            {t('bizprocRobotsTitle')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('bizprocRobotsDescription')}
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
          {t('bizprocRobotsRefresh')}
        </Button>
      </div>

      <div className="admin-card p-6">
        {state.kind === 'loading' ? (
          <p className="text-sm text-muted-foreground">
            {t('bizprocRobotsLoading')}
          </p>
        ) : null}

        {state.kind === 'error' ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {state.message}
          </p>
        ) : null}

        {state.kind === 'ready' && state.robots.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('bizprocRobotsEmpty')}
          </p>
        ) : null}

        {state.kind === 'ready' && state.robots.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-border bg-background">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">
                    {t('bizprocRobotsColumnCode')}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t('bizprocRobotsColumnName')}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t('bizprocRobotsColumnApp')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {state.robots.map(robot => (
                  <tr
                    key={robot.code}
                    className="border-b border-border last:border-b-0"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-foreground">
                      {robot.code}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {robot.name ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      {robot.isThinkzap ? (
                        <span className="inline-flex rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          {t('bizprocRobotsBadgeThinkzap')}
                        </span>
                      ) : (
                        <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          {t('bizprocRobotsBadgeOther')}
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
