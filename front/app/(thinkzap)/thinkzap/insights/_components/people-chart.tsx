'use client'

import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { formatDuration } from '@/lib/insights-format'
import type { OperatorRow } from '@/app/hooks/insights-types'
import { CHART } from './chart-colors'
import { Legend } from './ui-bits'

/**
 * Equipe: volume × rapidez. Barra por pessoa (respondidas, sem resposta,
 * abertas) e, à direita, a espera típica pela 1ª resposta. Barras em CSS:
 * não há eixo a desenhar.
 */
export function PeopleChart({
  operators,
  refSec,
}: {
  operators: OperatorRow[]
  refSec: number
}) {
  const { t } = useTranslation('thinkzap/insights')
  const list = operators.filter(o => o.total)
  if (!list.length) return null
  const max = Math.max(...list.map(o => o.total))
  const width = (v: number) => `${(Math.max(0, v) / max) * 100}%`

  return (
    <div>
      <div className="grid grid-cols-[minmax(90px,160px)_1fr_auto] items-center gap-x-3 gap-y-2 text-sm">
        {list.map(o => (
          <div key={o.id} className="contents">
            <div className="truncate" title={o.dept}>
              {o.name}
            </div>
            <div className="flex h-4 items-center">
              <i
                className={cn('block h-full rounded-l-sm', CHART.answered.bg)}
                style={{ width: width(o.answered) }}
                title={t('people.answered', { count: o.answered })}
              />
              <i
                className={cn('block h-full', CHART.noAnswer.bg)}
                style={{ width: width(o.noAnswer) }}
                title={t('people.noAnswer', { count: o.noAnswer })}
              />
              <i
                className={cn('block h-full', CHART.open.bg)}
                style={{ width: width(o.total - o.answered - o.noAnswer) }}
              />
              <span className="ml-1.5 text-xs text-muted-foreground">
                {o.total}
              </span>
            </div>
            <div
              className={cn(
                'text-xs whitespace-nowrap',
                o.medianFirstAnswer == null
                  ? 'text-muted-foreground'
                  : o.medianFirstAnswer > refSec
                    ? 'text-red-600'
                    : 'text-emerald-600',
              )}
            >
              {o.medianFirstAnswer == null
                ? t('people.noReply')
                : t('people.repliesIn', {
                    value: formatDuration(o.medianFirstAnswer),
                  })}
            </div>
          </div>
        ))}
      </div>
      <Legend
        items={[
          { label: t('legend.answered'), swatch: CHART.answered.bg },
          { label: t('legend.noAnswer'), swatch: CHART.noAnswer.bg },
          { label: t('legend.open'), swatch: CHART.open.bg },
        ]}
      />
      <p className="mt-1 text-xs text-muted-foreground">
        {t('people.note', { value: formatDuration(refSec) })}
      </p>
    </div>
  )
}
