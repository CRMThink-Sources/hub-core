'use client'

import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import {
  deltaPercent,
  formatDuration,
  formatMoney,
  formatPercent,
} from '@/lib/insights-format'
import type {
  DashboardResult,
  InsightsConfig,
} from '@/app/hooks/insights-types'

/**
 * Seta contra o período anterior. `betterUp` diz para que lado é bom: mais
 * conversas é bom, mais espera é ruim.
 */
function Delta({
  current,
  previous,
  betterUp,
}: {
  current: number | null
  previous: number | null
  betterUp: boolean
}) {
  const { t } = useTranslation('thinkzap/insights')
  const d = deltaPercent(current, previous)
  if (d === null) return null
  if (d === 0) {
    return <span className="text-muted-foreground">{t('kpi.deltaSame')}</span>
  }
  const good = betterUp ? d > 0 : d < 0
  return (
    <span className={good ? 'text-emerald-600' : 'text-red-600'}>
      {d > 0 ? '▲' : '▼'} {Math.abs(d)}%
    </span>
  )
}

function Kpi({
  label,
  value,
  sub,
  desc,
}: {
  label: string
  value: string
  sub: React.ReactNode
  desc: string
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-xl border border-border bg-card p-4">
      <span className="text-xs font-semibold text-foreground">{label}</span>
      <span className="text-xl font-bold leading-tight">{value}</span>
      <span className="text-xs text-muted-foreground">{sub}</span>
      <p
        className={cn(
          'mt-2 border-t border-border pt-2 text-xs leading-relaxed text-muted-foreground',
        )}
      >
        {desc}
      </p>
    </div>
  )
}

/** Os indicadores do Desempenho do original, na mesma ordem. */
export function KpiGrid({
  data,
  config,
}: {
  data: DashboardResult
  config: InsightsConfig
}) {
  const { t, i18n } = useTranslation('thinkzap/insights')
  const lang = i18n.language
  const k = data.kpi
  const p = data.prev
  const tt = data.teamTotal

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3">
      <Kpi
        label={t('kpi.conversations.label')}
        value={String(k.total)}
        sub={
          <>
            <Delta current={k.total} previous={p.total} betterUp />{' '}
            {t('kpi.conversations.perDay', { value: data.perDay })}
          </>
        }
        desc={t('kpi.conversations.desc')}
      />
      <Kpi
        label={t('kpi.direction.label')}
        value={`${tt.received} · ${tt.initiated}`}
        sub={t('kpi.direction.sub')}
        desc={t('kpi.direction.desc')}
      />
      <Kpi
        label={t('kpi.contacts.label')}
        value={String(tt.uniqueContacts)}
        sub={t('kpi.contacts.sub', { count: k.recurrentClients })}
        desc={t('kpi.contacts.desc')}
      />
      <Kpi
        label={t('kpi.firstAnswer.label')}
        value={formatDuration(k.medianFirstAnswer)}
        sub={
          <>
            {t('kpi.average', { value: formatDuration(tt.avgFirstAnswer) })}{' '}
            <Delta
              current={k.medianFirstAnswer}
              previous={p.medianFirstAnswer}
              betterUp={false}
            />
          </>
        }
        desc={
          t('kpi.firstAnswer.desc') +
          (config.bizOnly ? ` ${t('kpi.firstAnswer.bizOnly')}` : '')
        }
      />
      <Kpi
        label={t('kpi.reply.label')}
        value={formatDuration(tt.avgReply)}
        sub={t('kpi.reply.sub')}
        desc={t('kpi.reply.desc')}
      />
      <Kpi
        label={t('kpi.handling.label')}
        value={formatDuration(k.medianClose)}
        sub={t('kpi.average', { value: formatDuration(tt.avgHandling) })}
        desc={t('kpi.handling.desc')}
      />
      <Kpi
        label={t('kpi.messages.label')}
        value={`${tt.msgsSent} · ${tt.msgsReceived}`}
        sub={t('kpi.messages.sub')}
        desc={t('kpi.messages.desc')}
      />
      <Kpi
        label={t('kpi.return.label')}
        value={tt.returnBase ? formatPercent(tt.returnRate, lang) : '—'}
        sub={
          tt.returnBase
            ? t('kpi.return.sub', { count: tt.returnBase })
            : t('kpi.return.none')
        }
        desc={t('kpi.return.desc')}
      />
      <Kpi
        label={t('kpi.crm.label')}
        value={formatPercent(k.crmPct, lang)}
        sub={t('kpi.crm.sub', { count: k.deals })}
        desc={t('kpi.crm.desc')}
      />
      <Kpi
        label={t('kpi.takeover.label')}
        value={formatDuration(k.medianTakeover)}
        sub={t('kpi.average', { value: formatDuration(tt.avgTakeover) })}
        desc={t('kpi.takeover.desc')}
      />
      <Kpi
        label={t('kpi.stuck.label')}
        value={String(k.stuck)}
        sub={
          k.stuckOpen
            ? t('kpi.stuck.open', { count: k.stuckOpen })
            : t('kpi.stuck.noneOpen')
        }
        desc={t('kpi.stuck.desc', { days: config.stuckDays })}
      />
      <Kpi
        label={t('kpi.won.label')}
        value={`${tt.dealsWon} · ${formatMoney(tt.wonAmount)}`}
        sub={t('kpi.won.sub', {
          total: tt.dealsTotal,
          open: tt.dealsOpen,
          lost: tt.dealsLost,
        })}
        desc={t('kpi.won.desc', { days: config.dealWindowDays })}
      />
    </div>
  )
}
