'use client'

import { useTranslation } from 'react-i18next'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { sendPagination } from './envios-view'

type Props = {
  page: number
  total: number
  limit: number
  locale: string
  disabled?: boolean
  onPageChange: (page: number) => void
}

export function SendsPagination({
  page,
  total,
  limit,
  locale,
  disabled = false,
  onPageChange,
}: Props) {
  const { t } = useTranslation('thinkzap/envios')
  const { totalPages, hasPrevious, hasNext } = sendPagination(
    total,
    limit,
    page,
  )
  const number = new Intl.NumberFormat(locale)

  return (
    <nav
      aria-label={t('pagination.ariaLabel')}
      className="flex flex-wrap items-center justify-between gap-2"
    >
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t('pagination.summary', {
          page: number.format(page),
          totalPages: number.format(totalPages),
          total: number.format(total),
        })}
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || !hasPrevious}
          // Link antigo com página além do total: "anterior" leva à última.
          onClick={() => onPageChange(Math.min(page - 1, totalPages))}
        >
          <ChevronLeftIcon className="size-4" aria-hidden />
          {t('pagination.previous')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || !hasNext}
          onClick={() => onPageChange(page + 1)}
        >
          {t('pagination.next')}
          <ChevronRightIcon className="size-4" aria-hidden />
        </Button>
      </div>
    </nav>
  )
}
