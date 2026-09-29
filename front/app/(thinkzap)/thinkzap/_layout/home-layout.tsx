'use client'

import { useEffect, useState } from 'react'
import { BadgeCheck, Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { BX24Script } from '@/bitrix'
import { useAplicationContext } from '@/providers/aplication-provider'
import { listSubscriptionLines } from '@/shared/aplication/subscription-items'
import {
  resolveThinkzapClient,
  thinkzapApiErrorMessage,
} from '../_lib/thinkzap-client'
import {
  getThinkzapHomeMessageStats,
  type ThinkzapHomeMessageStats,
} from '../_lib/get-thinkzap-home-message-stats'
import { defaultRange, previousRange } from '../_lib/home-message-stats-range'
import { sumCounts, ZERO_COUNTS } from '../_lib/message-stats-math'
import { useBitrixUserName } from '../_lib/use-bitrix-user-name'
import { HomeHero } from '../_components/home/home-hero'
import { HomeShortcuts } from '../_components/home/home-shortcuts'
import { OnboardingCta } from '../_components/home/onboarding-cta'
import { MessageStatsPeriodPicker } from '../_components/home/message-stats-period-picker'
import { MessageStatsCard } from '../_components/home/message-stats-card'
import { MessageStatsSummary } from '../_components/home/message-stats-summary'
import { ProviderShareBar } from '../_components/home/provider-share-bar'

type StatsState =
  | { status: 'loading' }
  | {
      status: 'ready'
      current: ThinkzapHomeMessageStats
      previous: ThinkzapHomeMessageStats
    }
  | { status: 'error'; message: string }

/**
 * Home do ThinkZap — contagem de mensagens enviadas/recebidas por provider,
 * resumo total, variação contra o período anterior e navegação para o resto do
 * módulo.
 *
 * Quais cards aparecem e quantas linhas ativas cada provider tem vêm do mesmo
 * contexto de assinatura que o resto do módulo usa (`useAplicationContext`), não
 * de uma segunda leitura: é o dado que `/thinkzap/conexoes` já resolve.
 */
export default function ThinkzapHomeLayout() {
  const { t } = useTranslation('thinkzap/home')
  const { state: aplicationState } = useAplicationContext()
  const [range, setRange] = useState(() => defaultRange())
  const [statsState, setStatsState] = useState<StatsState>({
    status: 'loading',
  })
  const [bx24Ready, setBx24Ready] = useState(false)
  const bitrixUser = useBitrixUserName(bx24Ready)

  useEffect(() => {
    let cancelled = false
    setStatsState({ status: 'loading' })

    const resolved = resolveThinkzapClient()
    if (!resolved.ok) {
      setStatsState({ status: 'error', message: resolved.message })
      return
    }

    const previous = previousRange(range.from, range.to)

    Promise.all([
      getThinkzapHomeMessageStats(resolved.client, range),
      getThinkzapHomeMessageStats(resolved.client, previous),
    ])
      .then(([current, previousStats]) => {
        if (!cancelled) {
          setStatsState({ status: 'ready', current, previous: previousStats })
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setStatsState({
            status: 'error',
            message: thinkzapApiErrorMessage(error, t('statsError')),
          })
        }
      })

    return () => {
      cancelled = true
    }
    // `t` fica fora das deps de propósito: trocar de idioma não refaz a busca.
  }, [range])

  if (aplicationState.status === 'loading') {
    return (
      <>
        <BX24Script onLoad={() => setBx24Ready(true)} />
        <div className="flex min-h-[50vh] items-center justify-center gap-2 py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
          <span className="animate-pulse text-sm font-medium text-muted-foreground">
            {t('loading')}
          </span>
        </div>
      </>
    )
  }

  if (aplicationState.status !== 'ready') {
    return (
      <>
        <BX24Script onLoad={() => setBx24Ready(true)} />
        <div className="mx-auto mt-10 max-w-2xl rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <p className="text-sm font-medium">{t('installationError')}</p>
        </div>
      </>
    )
  }

  const activeLines = listSubscriptionLines(
    aplicationState.subscriptions,
  ).filter(line => line.status === 'active')
  const zapiLines = activeLines.filter(line => line.provider === 'ZAPI')
  const hubmessageLines = activeLines.filter(
    line => line.provider === 'HUBMESSAGE',
  )
  const hasZapi = zapiLines.length > 0
  const hasHubmessage = hubmessageLines.length > 0
  const hasAnyLine = hasZapi || hasHubmessage

  const isLoadingStats = statsState.status === 'loading'
  const currentZapi =
    statsState.status === 'ready'
      ? (statsState.current.zapi ?? ZERO_COUNTS)
      : ZERO_COUNTS
  const currentHubmessage =
    statsState.status === 'ready'
      ? (statsState.current.hubmessage ?? ZERO_COUNTS)
      : ZERO_COUNTS
  const previousTotal =
    statsState.status === 'ready'
      ? sumCounts(
          statsState.previous.zapi ?? ZERO_COUNTS,
          statsState.previous.hubmessage ?? ZERO_COUNTS,
        )
      : ZERO_COUNTS
  const currentTotal = sumCounts(currentZapi, currentHubmessage)

  /**
   * Nome+sobrenome do usuário Bitrix logado quando o BX24 resolve; nome do
   * cliente/domínio como fallback — fora do iframe do Bitrix (ou falha da
   * chamada) `bitrixUser.name` fica `null` e a saudação não quebra.
   */
  const greetingName =
    bitrixUser.status === 'ready' && bitrixUser.name
      ? bitrixUser.name
      : aplicationState.customer.name

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <BX24Script onLoad={() => setBx24Ready(true)} />
      <HomeHero greetingName={greetingName} />

      {!hasAnyLine && <OnboardingCta />}

      {hasAnyLine && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">{t('stats.title')}</h2>
            <MessageStatsPeriodPicker
              from={range.from}
              to={range.to}
              onChange={setRange}
            />
          </div>

          {statsState.status === 'error' && (
            <p className="text-sm text-destructive">{statsState.message}</p>
          )}

          {statsState.status !== 'error' &&
            (isLoadingStats ? (
              <p className="text-sm text-muted-foreground">{t('loading')}</p>
            ) : (
              <>
                <MessageStatsSummary
                  current={currentTotal}
                  previous={previousTotal}
                />

                <div className="flex flex-wrap gap-4">
                  {hasZapi && (
                    <MessageStatsCard
                      title="Web"
                      icon={Globe}
                      activeLines={zapiLines.length}
                      counts={currentZapi}
                      previous={
                        statsState.status === 'ready'
                          ? (statsState.previous.zapi ?? ZERO_COUNTS)
                          : ZERO_COUNTS
                      }
                    />
                  )}
                  {hasHubmessage && (
                    <MessageStatsCard
                      title="Business"
                      icon={BadgeCheck}
                      activeLines={hubmessageLines.length}
                      counts={currentHubmessage}
                      previous={
                        statsState.status === 'ready'
                          ? (statsState.previous.hubmessage ?? ZERO_COUNTS)
                          : ZERO_COUNTS
                      }
                    />
                  )}
                </div>

                {hasZapi && hasHubmessage && (
                  <ProviderShareBar
                    zapiTotal={currentZapi.sent + currentZapi.received}
                    hubmessageTotal={
                      currentHubmessage.sent + currentHubmessage.received
                    }
                  />
                )}
              </>
            ))}
        </div>
      )}

      <HomeShortcuts />
    </div>
  )
}
