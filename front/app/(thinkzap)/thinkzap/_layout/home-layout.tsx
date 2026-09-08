'use client'

import { useEffect, useState } from 'react'
import { useAplicationContext } from '@/providers/aplication-provider'
import { listSubscriptionLines } from '@/shared/aplication/subscription-items'
import {
  resolveThinkzapClient,
  thinkzapApiErrorMessage,
} from '../_lib/thinkzap-client'
import {
  getThinkzapHomeMessageStats,
  type MessageDirectionCounts,
  type ThinkzapHomeMessageStats,
} from '../_lib/get-thinkzap-home-message-stats'
import { defaultRange } from '../_lib/home-message-stats-range'
import { MessageStatsPeriodPicker } from '../_components/home/message-stats-period-picker'
import { MessageStatsCard } from '../_components/home/message-stats-card'

type StatsState =
  | { status: 'loading' }
  | { status: 'ready'; stats: ThinkzapHomeMessageStats }
  | { status: 'error'; message: string }

const ZERO: MessageDirectionCounts = { sent: 0, received: 0 }

/**
 * Home do ThinkZap — contagem de mensagens enviadas/recebidas por provider.
 *
 * Quais cards aparecem vem do mesmo contexto de assinatura que o resto do
 * módulo usa (`useAplicationContext`), não de uma segunda leitura: é o dado que
 * `/thinkzap/conexoes` já resolve para decidir o que a instalação tem.
 */
export default function ThinkzapHomeLayout() {
  const { state: aplicationState } = useAplicationContext()
  const [range, setRange] = useState(() => defaultRange())
  const [statsState, setStatsState] = useState<StatsState>({
    status: 'loading',
  })

  useEffect(() => {
    let cancelled = false
    setStatsState({ status: 'loading' })

    const resolved = resolveThinkzapClient()
    if (!resolved.ok) {
      setStatsState({ status: 'error', message: resolved.message })
      return
    }

    getThinkzapHomeMessageStats(resolved.client, range)
      .then(stats => {
        if (!cancelled) setStatsState({ status: 'ready', stats })
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setStatsState({
            status: 'error',
            message: thinkzapApiErrorMessage(
              error,
              'Não foi possível carregar as estatísticas.',
            ),
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [range])

  if (aplicationState.status === 'loading') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
        <span className="animate-pulse text-sm font-medium text-muted-foreground">
          Carregando...
        </span>
      </div>
    )
  }

  if (aplicationState.status !== 'ready') {
    return (
      <div className="mx-auto mt-10 max-w-2xl rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
        <p className="text-sm font-medium">
          Não foi possível carregar sua instalação
        </p>
      </div>
    )
  }

  const activeLines = listSubscriptionLines(
    aplicationState.subscriptions,
  ).filter(line => line.status === 'active')
  const hasZapi = activeLines.some(line => line.provider === 'ZAPI')
  const hasHubmessage = activeLines.some(line => line.provider === 'HUBMESSAGE')

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-xl font-semibold">Mensagens</h1>

      <div className="mt-4">
        <MessageStatsPeriodPicker
          from={range.from}
          to={range.to}
          onChange={setRange}
        />
      </div>

      {!hasZapi && !hasHubmessage && (
        <p className="mt-8 text-sm text-muted-foreground">
          Nenhuma linha ativa de WhatsApp Web ou Oficial nesta instalação.
        </p>
      )}

      {statsState.status === 'error' && (
        <p className="mt-8 text-sm text-destructive">{statsState.message}</p>
      )}

      {(hasZapi || hasHubmessage) && statsState.status !== 'error' && (
        <div className="mt-6 flex flex-wrap gap-4">
          {statsState.status === 'loading' && (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          )}
          {statsState.status === 'ready' && (
            <>
              {hasZapi && (
                <MessageStatsCard
                  title="Web"
                  counts={statsState.stats.zapi ?? ZERO}
                />
              )}
              {hasHubmessage && (
                <MessageStatsCard
                  title="Oficial"
                  counts={statsState.stats.hubmessage ?? ZERO}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
