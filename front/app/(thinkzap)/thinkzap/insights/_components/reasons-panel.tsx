'use client'

import { useTranslation } from 'react-i18next'
import { formatPercent } from '@/lib/insights-format'
import { knownReasonKey, sortReasons } from '@/lib/insights-full'
import { Panel } from './ui-bits'

/**
 * Motivos de fechamento. As chaves vêm da Vibe API e podem ser qualquer
 * texto: as conhecidas passam pelo i18n; as demais aparecem como texto puro,
 * sem tradução, em vez de sumirem ou virarem "outro".
 */
export function ReasonsPanel({
  reasons,
}: {
  reasons: Record<string, number> | null
}) {
  const { t, i18n } = useTranslation('thinkzap/insights')
  const rows = sortReasons(reasons)

  return (
    <Panel title={t('full.reasons.title')}>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('full.reasons.empty')}
        </p>
      ) : (
        <ul className="grid gap-2">
          {rows.map(row => {
            const known = knownReasonKey(row.key)
            return (
              <li key={row.key} className="grid gap-1 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate" title={row.key}>
                    {known ? t(`full.reasons.known.${known}`) : row.key}
                  </span>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {row.count} · {formatPercent(row.share, i18n.language)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${Math.min(100, Math.max(0, row.share))}%`,
                    }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}
