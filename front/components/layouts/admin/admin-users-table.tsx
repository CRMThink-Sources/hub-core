'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { formatPortalDate } from '@/lib/format-date'
import { cn } from '@/lib/utils'
import type { PortalUserSummary } from '@/lib/portal-users'
import { AdminUserBitrixIdDialog } from './admin-user-bitrix-id-dialog'

type Props = {
  users: PortalUserSummary[]
  /** Depois de salvar o ID do Bitrix de um usuário, para a lista recarregar. */
  onUpdated: () => void
}

export function AdminUsersTable({ users, onUpdated }: Props) {
  const { t, i18n } = useTranslation('admin/usuarios')
  const locale = i18n.language
  const [editing, setEditing] = useState<PortalUserSummary | null>(null)

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-background">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3 font-medium">{t('table.name')}</th>
            <th className="px-4 py-3 font-medium">{t('table.email')}</th>
            <th className="px-4 py-3 font-medium">{t('table.role')}</th>
            <th className="px-4 py-3 font-medium">{t('table.status')}</th>
            <th className="px-4 py-3 font-medium">{t('table.bitrixUserId')}</th>
            <th className="px-4 py-3 font-medium">{t('table.createdAt')}</th>
            <th className="px-4 py-3 text-right font-medium">
              {t('table.actions')}
            </th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr
              key={user.id}
              className="border-b border-border last:border-b-0 hover:bg-muted/30"
            >
              <td className="px-4 py-3 font-medium text-foreground">
                {user.name}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {t('roleAdmin')}
              </td>
              <td className="px-4 py-3">
                <span
                  className={cn(
                    'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                    user.isActive
                      ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {user.isActive ? t('status.active') : t('status.inactive')}
                </span>
              </td>
              <td className="px-4 py-3 tabular-nums text-muted-foreground">
                {user.bitrixUserId ?? '—'}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {formatPortalDate(user.createdAt, locale)}
              </td>
              <td className="px-4 py-3 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(user)}
                >
                  {t('bitrixDialog.edit')}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editing ? (
        <AdminUserBitrixIdDialog
          key={editing.id}
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={onUpdated}
        />
      ) : null}
    </div>
  )
}
