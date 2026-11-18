'use client'

import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { formatDuration, peakHours } from '@/lib/insights-format'
import type { DashboardResult, WaitBucket } from '@/app/hooks/insights-types'
import { CHART } from './chart-colors'
import { Legend, Muted, Panel } from './ui-bits'

const BUCKETS: { key: WaitBucket; bg: string }[] = [
  { key: 'le5', bg: 'bg-emerald-500' },
  { key: 'leSla', bg: 'bg-emerald-300' },
  { key: 'le60', bg: 'bg-amber-500' },
  { key: 'gt60', bg: 'bg-orange-500' },
  { key: 'never', bg: 'bg-red-500' },
  { key: 'waiting', bg: 'bg-slate-300' },
]

function WaitBar({
  buckets,
  label,
}: {
  buckets: Partial<Record<WaitBucket, number>>
  label: string
}) {
  const { t } = useTranslation('thinkzap/insights')
  const total = BUCKETS.reduce((a, b) => a + (buckets[b.key] ?? 0), 0)
  if (!total) return null
  return (
    <div className="my-2.5">
      <div className="mb-1 text-sm font-semibold">
        {label}{' '}
        <span className="font-normal text-muted-foreground">
          · {t('details.conversations', { count: total })}
        </span>
      </div>
      <div className="flex h-6 overflow-hidden rounded-md bg-muted">
        {BUCKETS.filter(b => buckets[b.key]).map(b => {
          const share = (buckets[b.key] ?? 0) / total
          return (
            <i
              key={b.key}
              className={cn(
                'flex items-center justify-center text-[11px] font-semibold not-italic text-white',
                b.bg,
              )}
              style={{ width: `${share * 100}%` }}
            >
              {share >= 0.08 ? `${Math.round(share * 100)}%` : ''}
            </i>
          )
        })}
      </div>
    </div>
  )
}

/** Barras verticais em CSS, para séries curtas sem eixo de espera. */
function ColumnChart({
  values,
  labels,
  titles,
  highlight,
}: {
  values: number[]
  labels: string[]
  titles: string[]
  highlight?: (v: number) => boolean
}) {
  const max = Math.max(1, ...values)
  const step = Math.ceil(values.length / 12)
  return (
    <div>
      <div className="flex h-32 items-end gap-1 border-b border-border pt-4">
        {values.map((v, i) => (
          <div
            key={i}
            title={titles[i]}
            className="relative flex h-full min-w-[6px] flex-1 flex-col justify-end"
          >
            {v ? (
              <span className="mb-0.5 text-center text-[10px] text-muted-foreground">
                {v}
              </span>
            ) : null}
            <i
              className={cn(
                'block w-full rounded-t-sm',
                highlight?.(v) ? CHART.volumePeak.bg : CHART.volume.bg,
              )}
              style={{ height: `${(v / max) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1 text-[10px] text-muted-foreground">
        {labels.map((l, i) => (
          <span
            key={i}
            className="min-w-[6px] flex-1 overflow-hidden text-center"
          >
            {i % step === 0 ? l : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * Detalhes que explicam os números do Desempenho (seção "detalhes" do
 * original): faixas de espera, conversas por dia, horários de pico e o mapa de
 * calor dia da semana × hora.
 */
export function WaitDetails({
  data,
  refMin,
}: {
  data: DashboardResult
  refMin: number
}) {
  const { t } = useTranslation('thinkzap/insights')
  const bh = data.businessHours
  const peak = peakHours(data.byHour)
  const heatMax = Math.max(1, ...data.heat.flat())
  const dm = (day: string) => `${day.slice(8)}/${day.slice(5, 7)}`

  return (
    <div className="grid gap-3">
      <Panel title={t('details.waitTitle')}>
        <p className="text-sm">
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
        <WaitBar
          buckets={data.waitBuckets.business}
          label={t('details.business')}
        />
        <WaitBar
          buckets={data.waitBuckets.outside}
          label={t('details.outsideLabel')}
        />
        <Legend
          items={BUCKETS.map(b => ({
            label: t(`details.bucket.${b.key}`, { min: refMin }),
            swatch: b.bg,
          }))}
        />
      </Panel>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title={t('details.dailyTitle')}>
          {data.daily.length ? (
            <ColumnChart
              values={data.daily.map(d => d.arrived)}
              labels={data.daily.map(d => dm(d.day))}
              titles={data.daily.map(d =>
                t('details.dailyTooltip', {
                  day: dm(d.day),
                  arrived: d.arrived,
                  answered: d.answered,
                  noAnswer: d.noAnswer,
                }),
              )}
            />
          ) : (
            <Muted>{t('empty.noConversations')}</Muted>
          )}
        </Panel>
        <Panel title={t('details.peakTitle')}>
          {peak ? (
            <>
              <p className="mb-1 text-sm">
                {t('details.peak', {
                  hours: peak.top
                    .map(h => t('details.hourRange', { from: h, to: h + 1 }))
                    .join(` ${t('details.and')} `),
                })}
              </p>
              <ColumnChart
                values={data.byHour.slice(peak.first, peak.last + 1)}
                labels={data.byHour
                  .slice(peak.first, peak.last + 1)
                  .map((_, i) => `${peak.first + i}h`)}
                titles={data.byHour
                  .slice(peak.first, peak.last + 1)
                  .map((v, i) => `${peak.first + i}h: ${v}`)}
                highlight={v => v === Math.max(...data.byHour)}
              />
            </>
          ) : (
            <Muted>{t('empty.noConversations')}</Muted>
          )}
        </Panel>
      </div>

      <Panel title={t('details.heatTitle')}>
        <div className="overflow-x-auto">
          <div className="grid min-w-[560px] grid-cols-[40px_repeat(24,minmax(0,1fr))] gap-0.5 text-[10px] text-muted-foreground">
            <span />
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="text-center">
                {h % 3 === 0 ? h : ''}
              </span>
            ))}
            {data.heat.map((row, d) => (
              <div key={d} className="contents">
                <span className="pr-1 text-right leading-5">
                  {t(`weekdays.${d}`)}
                </span>
                {row.map((v, h) => (
                  <span
                    key={h}
                    title={t('details.heatTooltip', {
                      day: t(`weekdays.${d}`),
                      hour: h,
                      count: v,
                    })}
                    className="h-5 rounded-sm bg-primary"
                    style={{ opacity: v ? 0.12 + (v / heatMax) * 0.88 : 0.04 }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </Panel>
    </div>
  )
}
