'use client'

import { useTranslation } from 'react-i18next'
import { formatPercent } from '@/lib/insights-format'
import { satisfactionPercent } from '@/lib/insights-full'
import type { InsightsSummary } from '@/app/hooks/insights-types'

function FullKpi({
  label,
  value,
  sub,
  desc,
}: {
  label: string
  value: string
  sub: string
  desc: string
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-xl border border-border bg-card p-4">
      <span className="text-xs font-semibold text-foreground">{label}</span>
      <span className="text-xl font-bold leading-tight">{value}</span>
      <span className="text-xs text-muted-foreground">{sub}</span>
      <p className="mt-2 border-t border-border pt-2 text-xs leading-relaxed text-muted-foreground">
        {desc}
      </p>
    </div>
  )
}

/**
 * Indicadores que só a Vibe API entrega (spam, abandono e nota do cliente).
 * Ficam numa grade própria logo abaixo da grade principal: assim a grade do
 * modo enxuto não ganha cartões vazios. Cada valor pode vir null mesmo no modo
 * completo e nesse caso mostra `—`, nunca `NaN`.
 */
export function FullKpis({ kpi }: { kpi: InsightsSummary }) {
  const { t, i18n } = useTranslation('thinkzap/insights')
  const lang = i18n.language
  const satisfaction = satisfactionPercent(kpi.likes, kpi.dislikes)
  const rated = (kpi.likes ?? 0) + (kpi.dislikes ?? 0)

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3">
      <FullKpi
        label={t('full.spam.label')}
        value={kpi.spam == null ? '—' : String(kpi.spam)}
        sub={t('full.spam.sub')}
        desc={t('full.spam.desc')}
      />
      <FullKpi
        label={t('full.abandon.label')}
        value={formatPercent(kpi.abandonPct, lang)}
        sub={t('full.abandon.sub')}
        desc={t('full.abandon.desc')}
      />
      <FullKpi
        label={t('full.rating.label')}
        value={satisfaction === null ? '—' : formatPercent(satisfaction, lang)}
        sub={
          kpi.likes == null && kpi.dislikes == null
            ? t('full.rating.none')
            : rated === 0
              ? t('full.rating.noRatings')
              : t('full.rating.sub', {
                  likes: kpi.likes ?? 0,
                  dislikes: kpi.dislikes ?? 0,
                })
        }
        desc={t('full.rating.desc')}
      />
    </div>
  )
}
