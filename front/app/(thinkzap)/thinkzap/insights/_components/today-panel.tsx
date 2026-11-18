'use client'

import { useTranslation } from 'react-i18next'
import { formatDuration } from '@/lib/insights-format'
import type { TodayResult } from '@/app/hooks/insights-types'
import { ErrorBox, LoadingBox } from './states'
import { Panel, Pill } from './ui-bits'

const th = 'px-2 py-2 text-left text-xs font-semibold text-muted-foreground'
const td = 'px-2 py-2 text-left whitespace-nowrap border-b border-border'

/**
 * Aba "Agora": quem cobrar neste momento. A contagem de atendentes online só
 * existe no modo completo (status ao vivo é da Vibe API); no enxuto
 * `operators` vem vazio e a frase some.
 */
export function TodayPanel({
  data,
  loading,
  error,
}: {
  data: TodayResult | null
  loading: boolean
  error: string | null
}) {
  const { t } = useTranslation('thinkzap/insights')

  if (error) return <ErrorBox message={error} />
  if (!data) return loading ? <LoadingBox /> : null

  const online = data.operators.filter(o => o.status !== 'offline').length
  const showOperators = data.mode === 'full' && data.operators.length > 0

  return (
    <div className={loading ? 'opacity-60 transition-opacity' : undefined}>
      <h2 className="text-xl font-semibold">{t('today.title')}</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        {t('today.summary', {
          total: data.today.total,
          open: data.open.length,
        })}
        {showOperators
          ? ` · ${t('today.online', { online, total: data.operators.length })}`
          : ''}
      </p>
      <Panel
        title={t('today.whoTitle')}
        actions={
          data.late ? (
            <Pill tone="bad">
              {t('today.lateBadge', { count: data.late, min: data.alertMin })}
            </Pill>
          ) : null
        }
      >
        {data.open.length === 0 ? (
          <p className="text-sm">{t('today.noneOpen')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className={th}>{t('today.cols.operator')}</th>
                  <th className={th}>{t('today.cols.age')}</th>
                  <th className={th}>{t('today.cols.status')}</th>
                  <th className={th}>{t('today.cols.crm')}</th>
                </tr>
              </thead>
              <tbody>
                {data.open.map(o => (
                  <tr key={o.id}>
                    <td className={td}>
                      {o.operator}
                      {o.dept ? (
                        <small className="block text-[11px] text-muted-foreground">
                          {o.dept}
                        </small>
                      ) : null}
                    </td>
                    <td className={td}>{formatDuration(o.ageMin * 60)}</td>
                    <td className={td}>
                      {o.late ? (
                        <Pill tone="bad">{t('today.status.late')}</Pill>
                      ) : o.waitingFirstAnswer ? (
                        <Pill tone="warn">{t('today.status.waiting')}</Pill>
                      ) : (
                        <Pill tone="good">{t('today.status.active')}</Pill>
                      )}
                    </td>
                    <td className={td}>{o.crm || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}
