'use client'

import { useTranslation } from 'react-i18next'
import { crmUrl, formatMoney } from '@/lib/insights-format'
import type { DashboardResult } from '@/app/hooks/insights-types'
import { Muted, Panel, Pill } from './ui-bits'

// As datas são instantes do Bitrix; o painel inteiro fala no horário de
// Brasília (os buckets por dia/hora da API também), então a lista também.
const TZ = 'America/Sao_Paulo'

const th = 'px-2 py-2 text-left text-xs font-semibold text-muted-foreground'
const td = 'px-2 py-2 text-left whitespace-nowrap border-b border-border'

function CrmLink({
  portal,
  type,
  id,
}: {
  portal: string | null
  type: string | null
  id: number | null
}) {
  const { t } = useTranslation('thinkzap/insights')
  const href = crmUrl(portal, type, id)
  if (!href || !type) return <>—</>
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline-offset-2 hover:underline"
    >
      {t(`crmType.${type}`)} #{id}
    </a>
  )
}

export function StuckList({
  data,
  stuckDays,
}: {
  data: DashboardResult
  stuckDays: number
}) {
  const { t, i18n } = useTranslation('thinkzap/insights')
  return (
    <Panel title={t('lists.stuck.title', { days: stuckDays })}>
      {data.stuckList.length === 0 ? (
        <>
          <p className="text-sm">
            {t('lists.stuck.empty', { days: stuckDays })}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {t('lists.stuck.closedNote', { count: data.kpi.stuck })}
          </p>
        </>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className={th}>{t('lists.stuck.since')}</th>
                <th className={th}>{t('lists.stuck.age')}</th>
                <th className={th}>{t('lists.with')}</th>
                <th className={th}>{t('lists.crm')}</th>
              </tr>
            </thead>
            <tbody>
              {data.stuckList.map(x => (
                <tr key={x.id}>
                  <td className={td}>
                    {new Date(x.date).toLocaleDateString(i18n.language, {
                      timeZone: TZ,
                    })}
                  </td>
                  <td className={`${td} text-red-600`}>
                    {t('lists.stuck.days', { count: x.days })}
                  </td>
                  <td className={td}>{x.operator}</td>
                  <td className={td}>
                    <CrmLink
                      portal={data.portal}
                      type={x.crmType}
                      id={x.crmId}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

export function WonList({ data }: { data: DashboardResult }) {
  const { t, i18n } = useTranslation('thinkzap/insights')
  const tt = data.teamTotal
  return (
    <Panel title={t('lists.won.title')}>
      {data.wonList.length === 0 ? (
        <>
          <Muted>{t('lists.won.empty')}</Muted>
          <p className="mt-2 text-xs text-muted-foreground">
            {t('lists.won.note', {
              total: tt.dealsTotal,
              open: tt.dealsOpen,
              lost: tt.dealsLost,
            })}
          </p>
        </>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className={th}>{t('lists.won.deal')}</th>
                <th className={th}>{t('lists.won.amount')}</th>
                <th className={th}>{t('lists.won.by')}</th>
                <th className={th}>{t('lists.won.date')}</th>
              </tr>
            </thead>
            <tbody>
              {data.wonList.map(x => (
                <tr key={x.id}>
                  <td className={td}>
                    <CrmLink portal={data.portal} type="deal" id={x.id} />
                    {x.title ? (
                      <small
                        className="block max-w-[230px] truncate text-[11px] text-muted-foreground"
                        title={x.title}
                      >
                        {x.title}
                      </small>
                    ) : null}
                  </td>
                  <td className={td}>{formatMoney(x.amount)}</td>
                  <td className={td}>{x.operator}</td>
                  <td className={td}>
                    {new Date(x.date).toLocaleDateString(i18n.language, {
                      timeZone: TZ,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

export function LostList({ data }: { data: DashboardResult }) {
  const { t, i18n } = useTranslation('thinkzap/insights')
  return (
    <Panel title={t('lists.lost.title')}>
      {data.lost.length === 0 ? (
        <p className="text-sm">{t('lists.lost.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className={th}>{t('lists.lost.arrived')}</th>
                <th className={th}>{t('lists.lost.with')}</th>
                <th className={th}>{t('lists.crm')}</th>
              </tr>
            </thead>
            <tbody>
              {data.lost.map(x => (
                <tr key={x.id}>
                  <td className={td}>
                    {new Date(x.date).toLocaleString(i18n.language, {
                      timeZone: TZ,
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {x.inBH ? null : (
                      <span className="ml-2">
                        <Pill tone="mute">{t('lists.lost.outsideHours')}</Pill>
                      </span>
                    )}
                  </td>
                  <td className={td}>{x.operator}</td>
                  <td className={td}>
                    <CrmLink
                      portal={data.portal}
                      type={x.crmType}
                      id={x.crmId}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}
