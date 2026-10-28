'use client'

import { ImageIcon, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import type {
  TemplateCategory,
  TemplateStatus,
} from '@/app/hooks/use-connector-templates'
import {
  EMPTY_FILTERS,
  hasActiveFilters,
  type TemplateFilters,
} from './template-view'

const STATUSES: (TemplateStatus | 'ALL')[] = [
  'ALL',
  'APPROVED',
  'PENDING',
  'REJECTED',
]
const CATEGORIES: (TemplateCategory | 'ALL')[] = [
  'ALL',
  'MARKETING',
  'UTILITY',
  'AUTHENTICATION',
]

type Props = {
  filters: TemplateFilters
  onChange: (filters: TemplateFilters) => void
  total: number
  shown: number
}

/** Busca, filtros e a contagem do que está na tela. */
export function TemplatesToolbar({ filters, onChange, total, shown }: Props) {
  const { t } = useTranslation('thinkzap/configuracoes/templates')
  const active = hasActiveFilters(filters)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative sm:w-72">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={filters.query}
            onChange={e => onChange({ ...filters, query: e.target.value })}
            placeholder={t('toolbar.buscar')}
            aria-label={t('toolbar.buscar')}
            className="h-9 pl-9"
          />
        </div>

        <div
          role="radiogroup"
          aria-label={t('toolbar.status')}
          className="inline-flex h-9 w-fit items-center rounded-lg bg-muted p-1"
        >
          {STATUSES.map(status => {
            const selected = filters.status === status
            return (
              <button
                key={status}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange({ ...filters, status })}
                className={`h-7 rounded-md px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                  selected
                    ? 'bg-background font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {status === 'ALL' ? t('toolbar.todos') : t(`status.${status}`)}
              </button>
            )
          })}
        </div>

        <select
          value={filters.category}
          onChange={e =>
            onChange({
              ...filters,
              category: e.target.value as TemplateCategory | 'ALL',
            })
          }
          aria-label={t('toolbar.categoria')}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          {CATEGORIES.map(category => (
            <option key={category} value={category}>
              {category === 'ALL'
                ? t('toolbar.todasCategorias')
                : t(`categoria.${category}`)}
            </option>
          ))}
        </select>

        <button
          type="button"
          aria-pressed={filters.onlyImage}
          onClick={() =>
            onChange({ ...filters, onlyImage: !filters.onlyImage })
          }
          className={`inline-flex h-9 w-fit items-center gap-1.5 rounded-md border px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
            filters.onlyImage
              ? 'border-foreground bg-foreground text-background'
              : 'border-input text-muted-foreground hover:text-foreground'
          }`}
        >
          <ImageIcon className="size-4" aria-hidden />
          {t('toolbar.comImagem')}
        </button>
      </div>

      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span aria-live="polite">
          {active
            ? t('toolbar.resultado', { shown, total })
            : t('toolbar.total', { count: total })}
        </span>
        {active && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTERS)}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {t('toolbar.limpar')}
          </button>
        )}
      </div>
    </div>
  )
}
