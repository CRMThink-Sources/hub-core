'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Pencil, ShieldCheck, User } from 'lucide-react'
import { axiosPortal } from '@/infra/client/axios-portal'
import { formatPortalDate } from '@/lib/format-date'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import type { McpUserSummary } from '@/lib/mcp-users'
import { isStrongPassword } from '@/lib/password-policy'
import { PasswordRequirements } from './password-requirements'

type DomainOption = { id: string; name: string }

type Props = {
  users: McpUserSummary[]
  domains: DomainOption[]
  onChanged: () => void
}

export function AdminMcpUsersTable({ users, domains, onChanged }: Props) {
  const { t, i18n } = useTranslation('admin/usuarios-mcp')
  const locale = i18n.language

  const [editing, setEditing] = useState<McpUserSummary | null>(null)
  const [name, setName] = useState('')
  const [domainId, setDomainId] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [isActive, setIsActive] = useState(true)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openEdit(user: McpUserSummary) {
    setEditing(user)
    setName(user.name)
    setDomainId(user.domainId)
    setIsAdmin(user.isAdmin)
    setIsActive(user.isActive)
    setPassword('')
    setConfirmPassword('')
    setError(null)
  }

  function closeEdit() {
    setEditing(null)
    setError(null)
  }

  async function handleSave() {
    if (!editing) return
    setError(null)

    // Senha é opcional no edit; se preenchida, exige forte + confirmação.
    if (password) {
      if (!isStrongPassword(password)) {
        setError(t('errorWeakPassword'))
        return
      }
      if (password !== confirmPassword) {
        setError(t('errorPasswordMismatch'))
        return
      }
    }

    setIsSaving(true)

    try {
      const payload: Record<string, unknown> = {
        name,
        domainId,
        isAdmin,
        isActive,
      }
      if (password) payload.password = password

      await axiosPortal().patch(`/portal/mcp-users/${editing.id}`, payload)
      closeEdit()
      onChanged()
    } catch {
      setError(t('editErrorGeneric'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border bg-background">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">{t('table.name')}</th>
              <th className="px-4 py-3 font-medium">{t('table.email')}</th>
              <th className="px-4 py-3 font-medium">{t('table.domain')}</th>
              <th className="px-4 py-3 font-medium">{t('table.access')}</th>
              <th className="px-4 py-3 font-medium">{t('table.status')}</th>
              <th className="px-4 py-3 font-medium">{t('table.createdAt')}</th>
              <th className="px-4 py-3 font-medium text-right">
                {t('table.actions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr
                key={user.id}
                className="border-b border-border transition-colors last:border-b-0 hover:bg-muted/30"
              >
                <td className="px-4 py-3 font-medium text-foreground">
                  {user.name}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {user.email}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {user.isAdmin ? t('allDomains') : user.domainName}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                      user.isAdmin
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {user.isAdmin ? (
                      <ShieldCheck className="size-3" />
                    ) : (
                      <User className="size-3" />
                    )}
                    {user.isAdmin ? t('accessAdmin') : t('accessClient')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
                      user.isActive
                        ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    <span
                      className={cn(
                        'size-1.5 rounded-full',
                        user.isActive
                          ? 'bg-green-500'
                          : 'bg-muted-foreground/50',
                      )}
                    />
                    {user.isActive ? t('status.active') : t('status.inactive')}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatPortalDate(user.createdAt, locale)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEdit(user)}
                  >
                    <Pencil className="size-3.5" />
                    {t('edit')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog
        open={editing !== null}
        onOpenChange={open => {
          if (!open) closeEdit()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('editTitle')}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-5">
            <p className="text-sm text-muted-foreground">{editing?.email}</p>

            <Field>
              <FieldLabel htmlFor="edit-name">{t('nameLabel')}</FieldLabel>
              <Input
                id="edit-name"
                value={name}
                onChange={e => setName(e.target.value)}
                disabled={isSaving}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="edit-domain">{t('domainLabel')}</FieldLabel>
              <Select
                value={domainId}
                onValueChange={(v: string | null) => setDomainId(v ?? '')}
              >
                <SelectTrigger id="edit-domain">
                  <SelectValue>
                    {(value: string) =>
                      domains.find(d => d.id === value)?.name ??
                      t('domainPlaceholder')
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {domains.map(d => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3">
              <div>
                <FieldLabel htmlFor="edit-admin">{t('adminLabel')}</FieldLabel>
                <p className="text-xs text-muted-foreground">
                  {t('adminHint')}
                </p>
              </div>
              <Switch
                id="edit-admin"
                checked={isAdmin}
                onCheckedChange={setIsAdmin}
                disabled={isSaving}
              />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3">
              <div>
                <FieldLabel htmlFor="edit-active">
                  {t('activeLabel')}
                </FieldLabel>
                <p className="text-xs text-muted-foreground">
                  {t('activeHint')}
                </p>
              </div>
              <Switch
                id="edit-active"
                checked={isActive}
                onCheckedChange={setIsActive}
                disabled={isSaving}
              />
            </div>

            <Field>
              <FieldLabel htmlFor="edit-password">
                {t('newPasswordLabel')}
              </FieldLabel>
              <Input
                id="edit-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={t('newPasswordPlaceholder')}
                disabled={isSaving}
              />
            </Field>

            {password ? <PasswordRequirements password={password} /> : null}

            {password ? (
              <Field>
                <FieldLabel htmlFor="edit-confirm-password">
                  {t('confirmPasswordLabel')}
                </FieldLabel>
                <Input
                  id="edit-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder={t('confirmPasswordPlaceholder')}
                  disabled={isSaving}
                />
              </Field>
            ) : null}

            {error ? <FieldError>{error}</FieldError> : null}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={closeEdit} disabled={isSaving}>
              {t('cancelCreate')}
            </Button>
            <Button
              onClick={() => {
                void handleSave()
              }}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t('saving')}
                </>
              ) : (
                t('save')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
