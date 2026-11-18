'use client'

import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import {
  formatPercent,
  noAnswerLevel,
  outOfTen,
  recontactLevel,
  slaLevel,
  trendOf,
  type HealthLevel,
  type Trend,
} from '@/lib/insights-format'
import type { InsightsSummary } from '@/app/hooks/insights-types'
import { InfoTip, Pill, levelTone } from './ui-bits'

const BORDER: Record<HealthLevel, string> = {
  good: 'border-l-emerald-500',
  warn: 'border-l-amber-500',
  bad: 'border-l-red-500',
  none: 'border-l-slate-300',
}

function HealthCard({
  title,
  level,
  headline,
  compare,
  tip,
}: {
  title: string
  level: HealthLevel
  headline: string
  compare: string
  tip: string
}) {
  const { t } = useTranslation('thinkzap/insights')
  return (
    <div
      className={cn(
        'min-w-0 rounded-xl border border-l-4 border-border bg-card p-4',
        BORDER[level],
      )}
    >
      <div className="mb-1.5 flex items-center gap-2 text-sm">
        <span className="flex-1 font-semibold text-foreground">{title}</span>
        <Pill tone={levelTone(level)}>{t(`health.level.${level}`)}</Pill>
        <InfoTip text={tip} />
      </div>
      <p className="text-base leading-snug text-foreground">{headline}</p>
      <p className="mt-1.5 text-xs text-muted-foreground">{compare}</p>
    </div>
  )
}

/**
 * Os três cartões de saúde do original (Rapidez, Ninguém sem resposta,
 * Resolvido de primeira), com os mesmos limites — ver `slaLevel` e afins.
 */
export function HealthCards({
  kpi,
  prev,
  refMin,
}: {
  kpi: InsightsSummary
  prev: InsightsSummary
  refMin: number
}) {
  const { t, i18n } = useTranslation('thinkzap/insights')
  const pct = (v: number | null) => formatPercent(v, i18n.language)

  const trendText = (trend: Trend, before: string) =>
    trend === 'none'
      ? t('health.trend.none')
      : trend === 'same'
        ? t('health.trend.same')
        : t(`health.trend.${trend}`, { before })

  // Rapidez: "8 em cada 10" igual nos dois períodos é "praticamente igual",
  // mesmo que o percentual tenha mexido na casa decimal.
  const slaCompare =
    kpi.slaPct != null &&
    prev.slaPct != null &&
    outOfTen(kpi.slaPct) === outOfTen(prev.slaPct)
      ? t('health.sla.almostSame', {
          before: pct(prev.slaPct),
          now: pct(kpi.slaPct),
        })
      : trendText(
          trendOf(kpi.slaPct, prev.slaPct, true),
          prev.slaPct == null
            ? ''
            : t('health.sla.outOfTen', { count: outOfTen(prev.slaPct) }),
        )

  const back = kpi.total
    ? Math.round((kpi.recontact48 / kpi.total) * 100)
    : null
  const prevBack = prev.total
    ? Math.round((prev.recontact48 / prev.total) * 100)
    : null

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <HealthCard
        title={t('health.sla.title')}
        level={slaLevel(kpi.slaPct)}
        headline={
          kpi.slaPct == null
            ? t('health.sla.none')
            : t('health.sla.headline', {
                count: outOfTen(kpi.slaPct),
                min: refMin,
              })
        }
        compare={slaCompare}
        tip={t('health.sla.tip', { min: refMin })}
      />
      <HealthCard
        title={t('health.noAnswer.title')}
        level={noAnswerLevel(kpi.noAnswerPct)}
        headline={
          !kpi.closed
            ? t('health.noAnswer.noneClosed')
            : kpi.noAnswer
              ? t('health.noAnswer.headline', {
                  count: kpi.noAnswer,
                  pct: pct(kpi.noAnswerPct),
                })
              : t('health.noAnswer.all')
        }
        compare={trendText(
          trendOf(kpi.noAnswer, prev.noAnswer, false),
          String(prev.noAnswer),
        )}
        tip={t('health.noAnswer.tip')}
      />
      <HealthCard
        title={t('health.recontact.title')}
        level={recontactLevel(kpi.recontact48, kpi.total)}
        headline={
          !kpi.total
            ? t('health.recontact.noConversations')
            : kpi.recontact48
              ? t('health.recontact.headline', { count: kpi.recontact48 })
              : t('health.recontact.none')
        }
        compare={trendText(
          trendOf(back, prevBack, false),
          prevBack == null
            ? ''
            : t('health.recontact.before', { pct: prevBack }),
        )}
        tip={t('health.recontact.tip', {
          recurrent: kpi.recurrentClients,
          clients: kpi.clients,
        })}
      />
    </div>
  )
}
