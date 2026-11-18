'use client'

import { useTranslation } from 'react-i18next'
import { formatDuration } from '@/lib/insights-format'
import type {
  DashboardResult,
  HourlyPoint,
  SeriesGranularity,
  SeriesPoint,
  TeamGranularity,
} from '@/app/hooks/insights-types'
import { ChannelSlaPanel } from './channel-sla-panel'
import { CHART } from './chart-colors'
import { FullKpis } from './full-kpis'
import { HealthCards } from './health-cards'
import { KpiGrid } from './kpi-grid'
import { MixedChart } from './mixed-chart'
import { PeopleChart } from './people-chart'
import { ReasonsPanel } from './reasons-panel'
import { LostList, StuckList, WonList } from './case-lists'
import { TeamReport } from './team-report'
import { WaitDetails } from './wait-details'
import { Panel, Segmented } from './ui-bits'

// Abaixo disso os percentuais oscilam muito: o original avisava a partir de 30.
const LOW_SAMPLE = 30

const dayLabel = (iso: string, lang: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(lang)

/**
 * Aba "Desempenho". Mesmos blocos nos dois modos: tudo aqui sai do REST
 * clássico. Os blocos que só existem com a Vibe API (spam, abandono, notas,
 * motivos, SLA do canal) são componentes próprios, renderizados só quando
 * `data.mode === 'full'`.
 */
export function PerformancePanel({
  data,
  scopeTitle,
  gran,
  onGranChange,
  seriesGran,
  onSeriesGranChange,
  selectedOperator,
  onSelectOperator,
}: {
  data: DashboardResult
  scopeTitle: string
  gran: TeamGranularity
  onGranChange: (gran: TeamGranularity) => void
  seriesGran: SeriesGranularity
  onSeriesGranChange: (gran: SeriesGranularity) => void
  selectedOperator: string
  onSelectOperator: (id: string) => void
}) {
  const { t, i18n } = useTranslation('thinkzap/insights')
  const lang = i18n.language
  const k = data.kpi
  const config = data.config
  const refMin = data.period.slaMin
  const refSec = refMin * 60
  const sg = data.seriesGran

  const header = (
    <>
      <h2 className="text-xl font-semibold">{scopeTitle}</h2>
      <p className="text-sm text-muted-foreground">
        {t('performance.subtitle', {
          from: dayLabel(data.period.from, lang),
          to: dayLabel(data.period.to, lang),
        })}
      </p>
    </>
  )

  if (k.total === 0) {
    return (
      <div className="grid gap-3">
        {header}
        <Panel>
          <p className="text-sm text-muted-foreground">{t('empty.period')}</p>
        </Panel>
      </div>
    )
  }

  const seriesLabel = (p: SeriesPoint, short: boolean) => {
    if (sg === 'day') {
      return short
        ? `${p.key.slice(8)}/${p.key.slice(5, 7)}`
        : new Date(`${p.key}T12:00:00`).toLocaleDateString(lang, {
            weekday: 'short',
            day: '2-digit',
            month: '2-digit',
          })
    }
    if (sg === 'week') {
      const dm = `${p.key.slice(8)}/${p.key.slice(5, 7)}`
      return short ? dm : t('team.weekOf', { date: dm })
    }
    return new Date(`${p.key}-15T12:00:00`).toLocaleDateString(lang, {
      month: short ? 'short' : 'long',
      year: short ? undefined : 'numeric',
    })
  }

  const hours = data.hourly.filter(h => h.arrived)
  const busiest = [...hours].sort((a, b) => b.arrived - a.arrived)[0]
  const worst = hours
    .filter(
      (h): h is HourlyPoint & { medianWait: number } => h.medianWait != null,
    )
    .sort((a, b) => b.medianWait - a.medianWait)[0]
  const bh = data.businessHours

  return (
    <div className="grid gap-3">
      {header}
      {k.total < LOW_SAMPLE ? (
        <p className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-800">
          {t('performance.lowSample', { count: k.total })}
        </p>
      ) : null}

      <HealthCards kpi={k} prev={data.prev} refMin={refMin} />
      <KpiGrid data={data} config={config} />
      {data.mode === 'full' ? <FullKpis kpi={k} /> : null}

      <Panel
        title={t(`series.title.${sg}`)}
        actions={
          <Segmented<SeriesGranularity>
            label={t('series.granularity')}
            value={seriesGran}
            onChange={onSeriesGranChange}
            options={[
              { value: 'day', label: t('gran.day') },
              { value: 'week', label: t('gran.week') },
              { value: 'month', label: t('gran.month') },
            ]}
          />
        }
      >
        <MixedChart<SeriesPoint>
          points={data.series}
          refSec={refSec}
          leftTitle={t('chart.leftAxis')}
          short={p => seriesLabel(p, true)}
          full={p => seriesLabel(p, false)}
          wait={p => p.medianWait}
          stacks={[
            {
              label: t('legend.answered'),
              color: CHART.answered,
              value: p => p.answered,
            },
            {
              label: t('legend.noAnswer'),
              color: CHART.noAnswer,
              value: p => p.noAnswer,
            },
            {
              label: t('legend.open'),
              color: CHART.open,
              value: p => p.pending,
            },
          ]}
        />
      </Panel>

      <Panel title={t('hourly.title')}>
        <p className="mb-2 text-sm text-foreground/80">
          {busiest
            ? t('hourly.busiest', { from: busiest.hour, to: busiest.hour + 1 })
            : null}{' '}
          {worst && worst.medianWait > refSec
            ? t('hourly.worst', {
                hour: worst.hour,
                value: formatDuration(worst.medianWait),
              })
            : null}
        </p>
        <MixedChart<HourlyPoint>
          points={hours}
          refSec={refSec}
          leftTitle={t('chart.leftAxis')}
          short={h => `${h.hour}h`}
          full={h => t('details.hourRange', { from: h.hour, to: h.hour + 1 })}
          wait={h => h.medianWait}
          stacks={[
            {
              label: t('legend.arrived'),
              color: CHART.volume,
              value: h => h.arrived,
            },
          ]}
        />
        <p className="mt-2 text-sm text-foreground/80">
          {bh.medianInside != null
            ? t('details.inside', {
                start: bh.start,
                end: bh.end,
                value: formatDuration(bh.medianInside),
              })
            : null}{' '}
          {bh.medianOutside != null
            ? t('details.outside', { value: formatDuration(bh.medianOutside) })
            : null}
        </p>
      </Panel>

      <Panel title={t('people.title')}>
        <p className="mb-2 text-sm text-foreground/80">{t('people.hint')}</p>
        <PeopleChart operators={data.operators} refSec={refSec} />
      </Panel>

      <TeamReport
        data={data}
        gran={gran}
        onGranChange={onGranChange}
        selectedOperator={selectedOperator}
        onSelectOperator={onSelectOperator}
        refSec={refSec}
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <StuckList data={data} stuckDays={config.stuckDays} />
        <WonList data={data} />
      </div>
      <LostList data={data} />

      <WaitDetails data={data} refMin={refMin} />

      {/* Blocos da Vibe API (motivos de fechamento e SLA do canal): só no modo
          completo. No enxuto esses campos vêm null e nada deles é renderizado.
          Spam, abandono e nota ficam em `FullKpis`, junto dos indicadores. */}
      {data.mode === 'full' ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <ReasonsPanel reasons={data.reasons} />
          <ChannelSlaPanel channelSla={data.channelSla} refMin={refMin} />
        </div>
      ) : null}
    </div>
  )
}
