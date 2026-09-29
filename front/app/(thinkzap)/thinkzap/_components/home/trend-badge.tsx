'use client'

import { useTranslation } from 'react-i18next'
import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Trend } from '../../_lib/message-stats-math'

export function TrendBadge({ trend }: { trend: Trend }) {
  const { t } = useTranslation('thinkzap/home')

  if (trend.kind === 'new') {
    return (
      <span className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
        {t('stats.trendNew')}
      </span>
    )
  }

  if (trend.kind === 'flat') {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
        <Minus className="size-3" />
        0%
      </span>
    )
  }

  const isUp = trend.kind === 'up'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium',
        isUp
          ? 'bg-emerald-500/10 text-emerald-600'
          : 'bg-red-500/10 text-red-600',
      )}
    >
      {isUp ? (
        <TrendingUp className="size-3" />
      ) : (
        <TrendingDown className="size-3" />
      )}
      {Math.round(trend.percent)}%
    </span>
  )
}
