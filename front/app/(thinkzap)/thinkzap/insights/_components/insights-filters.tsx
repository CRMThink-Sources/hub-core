'use client'

import { useTranslation } from 'react-i18next'
import type { DashboardResult } from '@/app/hooks/insights-types'

export type InsightsFilterState = {
  from: string
  to: string
  dept: string
  operator: string
}

const field =
  'h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

/**
 * Período, setor e pessoa. As opções de setor/pessoa vêm do próprio painel
 * (`filters`), então só aparecem depois da primeira leitura. Trocar o setor
 * limpa a pessoa: a pessoa escolhida podia ser de outro setor.
 */
export function InsightsFilters({
  value,
  onChange,
  options,
}: {
  value: InsightsFilterState
  onChange: (next: InsightsFilterState) => void
  options: DashboardResult['filters'] | null
}) {
  const { t } = useTranslation('thinkzap/insights')
  const operators = (options?.operators ?? []).filter(
    o => !value.dept || o.deptId === value.dept,
  )

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <input
        type="date"
        aria-label={t('filters.from')}
        className={field}
        value={value.from}
        max={value.to}
        onChange={e =>
          e.target.value && onChange({ ...value, from: e.target.value })
        }
      />
      <span>{t('filters.until')}</span>
      <input
        type="date"
        aria-label={t('filters.to')}
        className={field}
        value={value.to}
        min={value.from}
        onChange={e =>
          e.target.value && onChange({ ...value, to: e.target.value })
        }
      />
      <select
        aria-label={t('filters.dept')}
        className={`${field} max-w-[180px]`}
        value={value.dept}
        onChange={e =>
          onChange({ ...value, dept: e.target.value, operator: '' })
        }
      >
        <option value="">{t('filters.allDepts')}</option>
        {(options?.departments ?? []).map(d => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      <select
        aria-label={t('filters.operator')}
        className={`${field} max-w-[180px]`}
        value={value.operator}
        onChange={e => onChange({ ...value, operator: e.target.value })}
      >
        <option value="">{t('filters.allTeam')}</option>
        {operators.map(o => (
          <option key={o.id} value={String(o.id)}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  )
}
