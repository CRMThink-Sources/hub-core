'use client'

import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  buildTeamCsv,
  formatClock,
  formatDuration,
  formatMoney,
  formatPercent,
} from '@/lib/insights-format'
import type {
  DashboardResult,
  TeamGranularity,
  UserIndicators,
} from '@/app/hooks/insights-types'
import { Panel, Segmented } from './ui-bits'

const COLUMNS = [
  'conversations',
  'contacts',
  'messages',
  'firstAnswer',
  'reply',
  'handling',
  'noAnswer',
  'return',
  'shift',
  'takeover',
  'stuck',
  'won',
] as const

type Row = UserIndicators & { name: string; dept: string; id?: number }

const td = 'px-2 py-2 text-right whitespace-nowrap border-b border-border'

function bucketLabel(
  bucket: string,
  gran: TeamGranularity,
  lang: string,
  weekOf: (date: string) => string,
): string {
  if (gran === 'day') {
    return new Date(`${bucket}T12:00:00`).toLocaleDateString(lang, {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
    })
  }
  if (gran === 'week') {
    return weekOf(`${bucket.slice(8)}/${bucket.slice(5, 7)}`)
  }
  if (gran === 'month') {
    return new Date(`${bucket}-15T12:00:00`).toLocaleDateString(lang, {
      month: 'long',
      year: 'numeric',
    })
  }
  return ''
}

/**
 * Relatório da equipe com agrupamento (período, dia, semana, mês), planilha e
 * clique na linha para filtrar a página pela pessoa, como no original.
 */
export function TeamReport({
  data,
  gran,
  onGranChange,
  selectedOperator,
  onSelectOperator,
  refSec,
}: {
  data: DashboardResult
  gran: TeamGranularity
  onGranChange: (gran: TeamGranularity) => void
  selectedOperator: string
  onSelectOperator: (id: string) => void
  refSec: number
}) {
  const { t, i18n } = useTranslation('thinkzap/insights')
  const lang = i18n.language

  function renderRow(r: Row, kind: 'person' | 'total') {
    const selected = kind === 'person' && String(r.id) === selectedOperator
    return (
      <tr
        key={kind === 'total' ? 'total' : undefined}
        onClick={
          kind === 'person'
            ? () => onSelectOperator(selected ? '' : String(r.id))
            : undefined
        }
        className={cn(
          kind === 'person' && 'cursor-pointer hover:bg-muted/50',
          selected && 'bg-primary/10',
          kind === 'total' && 'font-bold',
        )}
      >
        <td className={cn(td, 'text-left')}>
          {r.name}
          {r.dept ? (
            <small className="block text-[11px] text-muted-foreground">
              {r.dept}
            </small>
          ) : null}
        </td>
        <td className={td}>
          {r.conversations}
          <small className="block text-[11px] text-muted-foreground">
            {t('team.direction', {
              received: r.received,
              initiated: r.initiated,
            })}
          </small>
        </td>
        <td className={td}>{r.uniqueContacts}</td>
        <td className={td}>
          {r.msgsSent}{' '}
          <span className="text-muted-foreground">/ {r.msgsReceived}</span>
        </td>
        <td
          className={cn(
            td,
            r.avgFirstAnswer != null &&
              r.avgFirstAnswer > refSec &&
              'text-red-600',
          )}
        >
          {formatDuration(r.avgFirstAnswer)}
        </td>
        <td className={td}>{formatDuration(r.avgReply)}</td>
        <td className={td}>{formatDuration(r.avgHandling)}</td>
        <td className={cn(td, r.noAnswer > 0 && 'text-red-600')}>
          {r.noAnswer}
        </td>
        <td className={td}>
          {r.returnBase ? (
            <>
              {formatPercent(r.returnRate, lang)}
              <small className="block text-[11px] text-muted-foreground">
                {t('team.ofBase', { count: r.returnBase })}
              </small>
            </>
          ) : (
            '—'
          )}
        </td>
        <td className={td}>
          {r.firstOfDay == null
            ? '—'
            : `${formatClock(r.firstOfDay)} – ${formatClock(r.lastOfDay)}`}
        </td>
        <td className={td}>{formatDuration(r.avgTakeover)}</td>
        <td className={cn(td, r.stuck > 0 && 'text-red-600')}>{r.stuck}</td>
        <td className={td}>
          {r.dealsWon ? (
            <>
              {r.dealsWon}
              <small className="block text-[11px] text-muted-foreground">
                {formatMoney(r.wonAmount)}
              </small>
            </>
          ) : r.dealsTotal ? (
            <>
              0
              <small className="block text-[11px] text-muted-foreground">
                {t('team.ofBase', { count: r.dealsTotal })}
              </small>
            </>
          ) : (
            '—'
          )}
        </td>
      </tr>
    )
  }

  function downloadCsv() {
    const minutes = (s: number | null) =>
      s == null ? '' : (s / 60).toFixed(1).replace('.', ',')
    // Sem o namespace carregado o i18next devolve a própria chave (string):
    // aí a planilha sai sem cabeçalho em vez de quebrar o clique.
    const raw: unknown = t('team.csv.headers', { returnObjects: true })
    const headers = Array.isArray(raw) ? raw.map(String) : []
    const rows = data.team.map(r => [
      r.bucket === 'total'
        ? `${data.period.from} – ${data.period.to}`
        : r.bucket,
      r.name,
      r.dept,
      r.conversations,
      r.received,
      r.initiated,
      r.uniqueContacts,
      r.msgsSent,
      r.msgsReceived,
      minutes(r.avgFirstAnswer),
      minutes(r.avgReply),
      minutes(r.avgHandling),
      r.noAnswer,
      r.returnRate,
      r.firstOfDay == null ? '' : formatClock(r.firstOfDay),
      r.lastOfDay == null ? '' : formatClock(r.lastOfDay),
      minutes(r.avgTakeover),
      r.stuck,
      r.dealsTotal,
      r.dealsWon,
      r.wonAmount,
    ])
    const blob = new Blob([buildTeamCsv(headers, rows)], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `thinkzap-equipe-${gran}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const weekOf = (date: string) => t('team.weekOf', { date })
  let lastBucket: string | null = null

  return (
    <Panel
      title={t('team.title')}
      actions={
        <>
          <Segmented<TeamGranularity>
            label={t('team.granularity')}
            value={gran}
            onChange={onGranChange}
            options={[
              { value: 'total', label: t('gran.total') },
              { value: 'day', label: t('gran.day') },
              { value: 'week', label: t('gran.week') },
              { value: 'month', label: t('gran.month') },
            ]}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={downloadCsv}
            disabled={!data.team.length}
          >
            <Download className="size-4" />
            {t('team.download')}
          </Button>
        </>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground">
                {t('team.person')}
              </th>
              {COLUMNS.map(col => (
                <th
                  key={col}
                  className="px-2 py-2 text-right align-bottom text-xs font-semibold text-muted-foreground"
                >
                  <span
                    title={t(`team.cols.${col}.tip`)}
                    className="cursor-help border-b border-dotted border-muted-foreground"
                  >
                    {t(`team.cols.${col}.label`)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.team.length === 0 ? (
              <tr>
                <td
                  colSpan={COLUMNS.length + 1}
                  className="px-2 py-3 text-muted-foreground"
                >
                  {t('empty.noConversations')}
                </td>
              </tr>
            ) : (
              data.team.map((r, i) => {
                const header =
                  gran !== 'total' && r.bucket !== lastBucket ? (
                    <tr className="bg-muted/60">
                      <td
                        colSpan={COLUMNS.length + 1}
                        className="px-2 py-1.5 text-xs font-semibold capitalize text-muted-foreground"
                      >
                        {bucketLabel(r.bucket, gran, lang, weekOf)}
                      </td>
                    </tr>
                  ) : null
                lastBucket = r.bucket
                return (
                  <Fragment key={`${r.bucket}-${r.id}-${i}`}>
                    {header}
                    {renderRow(r, 'person')}
                  </Fragment>
                )
              })
            )}
            {gran === 'total' && data.team.length > 1
              ? renderRow(
                  { ...data.teamTotal, name: t('team.total'), dept: '' },
                  'total',
                )
              : null}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{t('team.note')}</p>
    </Panel>
  )
}
