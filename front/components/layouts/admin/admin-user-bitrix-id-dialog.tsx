'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { axiosPortal } from '@/infra/client/axios-portal'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { parseBitrixUserId, type PortalUserSummary } from '@/lib/portal-users'

type Props = {
  user: PortalUserSummary
  onClose: () => void
  /** Chamado depois de salvar, para a lista recarregar. */
  onSaved: () => void
}

/** Define, troca ou remove o ID do usuário no Bitrix24 de um usuário do backoffice. */
export function AdminUserBitrixIdDialog({ user, onClose, onSaved }: Props) {
  const { t } = useTranslation('admin/usuarios')

  const [value, setValue] = useState(
    user.bitrixUserId === null ? '' : String(user.bitrixUserId),
  )
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  async function save(bitrixUserId: number | null) {
    setError(null)
    setIsSaving(true)

    try {
      await axiosPortal().patch(`/portal/users/${user.id}`, { bitrixUserId })
      onSaved()
      onClose()
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response
        ?.status
      setError(
        status === 404 ? t('bitrixDialog.errorNotFound') : t('errorBitrixSave'),
      )
    } finally {
      setIsSaving(false)
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const parsed = parseBitrixUserId(value)
    if (!parsed.valid) {
      setError(t('errorBitrixUserId'))
      return
    }
    void save(parsed.value)
  }

  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !isSaving) onClose()
      }}
    >
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t('bitrixDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('bitrixDialog.description', { name: user.name })}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-2">
            <Field>
              <FieldLabel htmlFor="bitrix-user-id">
                {t('bitrixUserIdLabel')}
              </FieldLabel>
              <Input
                id="bitrix-user-id"
                inputMode="numeric"
                autoComplete="off"
                value={value}
                onChange={event => setValue(event.target.value)}
                placeholder={t('bitrixUserIdPlaceholder')}
                disabled={isSaving}
                aria-invalid={error ? true : undefined}
              />
              <p className="text-xs text-muted-foreground">
                {t('bitrixUserIdHint')}
              </p>
            </Field>
            {error ? <FieldError>{error}</FieldError> : null}
          </DialogBody>

          <DialogFooter>
            {user.bitrixUserId !== null ? (
              <Button
                type="button"
                variant="outline"
                disabled={isSaving}
                onClick={() => void save(null)}
              >
                {t('bitrixDialog.removeLink')}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              onClick={onClose}
            >
              {t('bitrixDialog.cancel')}
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t('bitrixDialog.saving')}
                </>
              ) : (
                t('bitrixDialog.save')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
