'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { formatProductUpdateDate } from '@/components/product-updates/product-update-card'
import type {
  ProductUpdateListItem,
  ProductUpdateTask,
} from '@/lib/portal-product-updates'
import {
  BITRIX_TASK_STATUS,
  PRODUCT_UPDATE_SITUATION,
  STATUS_NAMESPACE,
  statusMeta,
} from '@/lib/portal-status'
import { cn } from '@/lib/utils'
import { AdminStatusBadge } from './ui/admin-status-badge'

const NAMESPACE = 'admin/product-updates'

const updateHref = (item: ProductUpdateListItem) =>
  `/admin/novidades/${encodeURIComponent(item.id)}`

/** Link que cobre a linha (ou o card) inteiro — o mesmo da tabela de clientes. */
const STRETCHED_LINK =
  "rounded-sm after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring/50 focus-visible:after:ring-inset"

/** "Aguardando revisão" é a fila do time: a linha ganha um fundo de atenção. */
const rowTone = (item: ProductUpdateListItem) =>
  item.situation === 'awaiting-review'
    ? 'bg-status-warning-soft/40 has-[a:hover]:bg-status-warning-soft/70'
    : 'has-[a:hover]:bg-muted/50'

/**
 * Tabela de novidades a partir de `md`; cards abaixo disso, para não haver rolagem
 * horizontal da página no celular.
 */
export function AdminProductUpdatesTable({
  items,
}: {
  items: ProductUpdateListItem[]
}) {
  const { t, i18n } = useTranslation(NAMESPACE)
  const locale = i18n.language

  return (
    <>
      <div className="hidden overflow-hidden rounded-lg border border-border bg-card md:block">
        <table
          aria-label={t('table.label')}
          className="w-full text-left text-sm"
        >
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th scope="col" className="px-5 py-3 font-medium">
                {t('table.title')}
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                {t('table.situation')}
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                {t('table.task')}
              </th>
              <th scope="col" className="px-5 py-3 text-right font-medium">
                {t('table.availableAt')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map(item => (
              <tr
                key={item.id}
                className={cn(
                  'relative align-top transition-colors',
                  rowTone(item),
                )}
              >
                <td className="w-[42%] px-5 py-3.5">
                  <Link
                    href={updateHref(item)}
                    className={cn(
                      STRETCHED_LINK,
                      'font-medium break-words text-foreground',
                      !item.title.trim() && 'text-muted-foreground italic',
                    )}
                  >
                    {item.title.trim() || t('untitled')}
                  </Link>
                  {item.hasPendingChanges && <PendingChanges />}
                </td>
                <td className="px-5 py-3.5">
                  <SituationBadge item={item} />
                </td>
                <td className="px-5 py-3.5">
                  <TaskCell task={item.task} />
                </td>
                <td className="px-5 py-3.5 text-right whitespace-nowrap text-muted-foreground tabular-nums">
                  {item.availableAt
                    ? (formatProductUpdateDate(item.availableAt, locale) ?? '—')
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul
        aria-label={t('table.label')}
        className="divide-y divide-border rounded-lg border border-border bg-card md:hidden"
      >
        {items.map(item => (
          <li
            key={item.id}
            className={cn(
              'relative px-4 py-4 transition-colors first:rounded-t-lg last:rounded-b-lg',
              rowTone(item),
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <Link
                href={updateHref(item)}
                className={cn(
                  STRETCHED_LINK,
                  'min-w-0 font-medium break-words text-foreground',
                  !item.title.trim() && 'text-muted-foreground italic',
                )}
              >
                {item.title.trim() || t('untitled')}
              </Link>
              <SituationBadge item={item} />
            </div>
            {item.hasPendingChanges && <PendingChanges />}
            <div className="mt-2 flex flex-wrap items-start justify-between gap-x-4 gap-y-1 text-sm">
              {item.task && <TaskCell task={item.task} />}
              {item.availableAt && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {t('table.availableAt')}{' '}
                  {formatProductUpdateDate(item.availableAt, locale)}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

function SituationBadge({ item }: { item: ProductUpdateListItem }) {
  const { t: tStatus } = useTranslation(STATUS_NAMESPACE)
  const meta = statusMeta(PRODUCT_UPDATE_SITUATION, item.situation)
  return (
    <AdminStatusBadge tone={meta.tone}>
      {tStatus(meta.labelKey)}
    </AdminStatusBadge>
  )
}

/** Indicador de alterações pendentes, sob o título. */
function PendingChanges() {
  const { t } = useTranslation(NAMESPACE)
  return (
    <span
      title={t('pendingChangesHint')}
      className="mt-1 flex w-fit items-center gap-1.5 text-xs text-status-warning-ink"
    >
      <span aria-hidden className="size-1.5 rounded-full bg-status-warning" />
      {t('pendingChanges')}
    </span>
  )
}

/** ID da tarefa e o status lido do Bitrix; "aguardando aprovação" na linha de baixo. */
export function TaskCell({ task }: { task: ProductUpdateTask | null }) {
  const { t } = useTranslation(NAMESPACE)
  const { t: tStatus } = useTranslation(STATUS_NAMESPACE)

  if (!task) return <span className="text-muted-foreground">—</span>

  const status =
    task.status === null
      ? null
      : statusMeta(BITRIX_TASK_STATUS, String(task.status))

  return (
    <div className="flex flex-col gap-0.5">
      <span className="flex items-center gap-2 whitespace-nowrap">
        <span className="font-medium text-foreground tabular-nums">
          #{task.id}
        </span>
        {status && (
          <AdminStatusBadge variant="dot" tone={status.tone}>
            <span className="text-muted-foreground">
              {tStatus(status.labelKey)}
            </span>
          </AdminStatusBadge>
        )}
      </span>
      {task.awaitingApproval && (
        <span className="text-xs whitespace-nowrap text-status-warning-ink">
          {t('awaitingApproval')}
        </span>
      )}
    </div>
  )
}
