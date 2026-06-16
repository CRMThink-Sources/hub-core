'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { axiosPortal } from '@/infra/client/axios-portal'
import { formatPortalDate } from '@/lib/format-date'
import type {
  AppSubscription,
  ListAppSubscriptionsResponse,
} from '@/lib/portal-domains'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'

type Props = {
  appId: string
}

type SectionState =
  | { kind: 'loading' }
  | { kind: 'ready'; subscriptions: AppSubscription[] }
  | { kind: 'error' }

type ActionModal =
  | { kind: 'none' }
  | { kind: 'extend-trial'; subscriptionId: string }
  | { kind: 'cancel-trial'; subscriptionId: string }
  | { kind: 'create-trial'; appId: string }
  | { kind: 'create-subscription'; appId: string }
  | { kind: 'cancel-subscription'; subscriptionId: string }

function SubscriptionActionButtons({
  sub,
  appId,
  onAction,
}: {
  sub: AppSubscription
  appId: string
  onAction: (modal: ActionModal) => void
}) {
  const { t } = useTranslation('admin/app-settings')

  if (sub.status === 'TRIALING') {
    return (
      <div className="flex gap-1">
        <Button
          size="xs"
          variant="outline"
          onClick={() =>
            onAction({ kind: 'extend-trial', subscriptionId: sub.id })
          }
        >
          {t('subscriptionActionsExtendTrial')}
        </Button>
        <Button
          size="xs"
          variant="destructive"
          onClick={() =>
            onAction({ kind: 'cancel-trial', subscriptionId: sub.id })
          }
        >
          {t('subscriptionActionsCancelTrial')}
        </Button>
      </div>
    )
  }

  if (sub.status === 'ACTIVE') {
    return (
      <Button
        size="xs"
        variant="destructive"
        onClick={() =>
          onAction({ kind: 'cancel-subscription', subscriptionId: sub.id })
        }
      >
        {t('subscriptionActionsCancelSubscription')}
      </Button>
    )
  }

  if (sub.status === 'CANCELLED') {
    return (
      <Button
        size="xs"
        variant="destructive"
        onClick={() => onAction({ kind: 'create-trial', appId: appId })}
      >
        {t('subscriptionActionsCreateTrial')}
      </Button>
    )
  }

  return null
}

function ExtendTrialModal({
  appId,
  subscriptionId,
  onClose,
  onSuccess,
}: {
  appId: string
  subscriptionId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const { t } = useTranslation('admin/app-settings')
  const [date, setDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const minDate = new Date()
  minDate.setDate(minDate.getDate() + 1)
  const minDateStr = minDate.toISOString().split('T')[0]

  async function handleSubmit() {
    if (!date) return
    setLoading(true)
    setError(null)
    try {
      await axiosPortal().patch(
        `/portal/apps/${appId}/subscriptions/${subscriptionId}/trial-end-date`,
        { trialEndsAt: new Date(date).toISOString() },
      )
      onSuccess()
    } catch {
      setError(t('subscriptionActionsErrorGeneric'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('subscriptionActionsExtendTrial')}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <label className="block text-sm font-medium text-foreground">
            {t('subscriptionActionsTrialEndDateLabel')}
          </label>
          <input
            type="date"
            min={minDateStr}
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t('subscriptionActionsCancel')}
          </DialogClose>
          <Button
            onClick={() => void handleSubmit()}
            disabled={!date || loading}
          >
            {loading ? '...' : t('subscriptionActionsConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CreateTrialModal({
  appId,
  onClose,
  onSuccess,
}: {
  appId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const { t } = useTranslation('admin/app-settings')
  const [days, setDays] = useState(7)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    try {
      await axiosPortal().post(`/portal/apps/${appId}/subscriptions/trial`, {
        trialDays: days,
      })
      onSuccess()
    } catch {
      setError(t('subscriptionActionsErrorGeneric'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('subscriptionActionsCreateTrial')}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <label className="block text-sm font-medium text-foreground">
            {t('subscriptionActionsTrialDaysLabel')}
          </label>
          <input
            type="number"
            min={1}
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t('subscriptionActionsCancel')}
          </DialogClose>
          <Button
            onClick={() => void handleSubmit()}
            disabled={days < 1 || loading}
          >
            {loading ? '...' : t('subscriptionActionsConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ConfirmActionModal({
  title,
  description,
  onConfirm,
  onClose,
}: {
  title: string
  description: string
  onConfirm: () => Promise<void>
  onClose: () => void
}) {
  const { t } = useTranslation('admin/app-settings')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setLoading(true)
    setError(null)
    try {
      await onConfirm()
    } catch {
      setError(t('subscriptionActionsErrorGeneric'))
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="text-sm text-muted-foreground">{description}</p>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t('subscriptionActionsCancel')}
          </DialogClose>
          <Button
            variant="destructive"
            onClick={() => void handleConfirm()}
            disabled={loading}
          >
            {loading ? '...' : t('subscriptionActionsConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AdminClientSubscriptionsSection({ appId }: Props) {
  const { t, i18n } = useTranslation('admin/app-settings')
  const locale = i18n.language
  const [state, setState] = useState<SectionState>({ kind: 'loading' })
  const [modal, setModal] = useState<ActionModal>({ kind: 'none' })

  function load() {
    setState({ kind: 'loading' })
    axiosPortal()
      .get<ListAppSubscriptionsResponse>(`/portal/apps/${appId}/subscriptions`)
      .then(result => {
        setState({ kind: 'ready', subscriptions: result.subscriptions })
      })
      .catch(() => {
        setState({ kind: 'error' })
      })
  }

  useEffect(() => {
    load()
  }, [appId])

  function closeModal() {
    setModal({ kind: 'none' })
  }

  function handleSuccess() {
    closeModal()
    load()
  }

  if (state.kind === 'loading') {
    return (
      <p className="text-sm text-muted-foreground">
        {t('subscriptionsLoading')}
      </p>
    )
  }

  if (state.kind === 'error') {
    return (
      <div className="admin-card p-6">
        <p className="text-sm text-muted-foreground">
          {t('subscriptionsErrorGeneric')}
        </p>
      </div>
    )
  }

  if (state.subscriptions.length === 0) {
    return (
      <div className="admin-card p-6">
        <p className="text-sm text-muted-foreground">
          {t('subscriptionsEmpty')}
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-medium text-foreground">
            {t('subscriptionsTitle')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('subscriptionsDescription')}
          </p>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border bg-background">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">
                  {t('subscriptionsColumnStatus')}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t('subscriptionsColumnStripeId')}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t('subscriptionsColumnConnectorQuantity')}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t('subscriptionsColumnTrialEndsAt')}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t('subscriptionsColumnCreatedAt')}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t('subscriptionsColumnActions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {state.subscriptions.map(sub => (
                <tr
                  key={sub.id}
                  className="border-b border-border last:border-b-0"
                >
                  <td className="px-4 py-3 text-foreground">
                    {t(`subscriptionStatus.${sub.status}`, {
                      defaultValue: sub.status,
                    })}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {sub.stripeSubscriptionId || '—'}
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {sub.connectorQuantity}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {sub.trialEndsAt
                      ? formatPortalDate(sub.trialEndsAt, locale)
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatPortalDate(sub.createdAt, locale)}
                  </td>
                  <td className="px-4 py-3">
                    <SubscriptionActionButtons
                      sub={sub}
                      appId={appId}
                      onAction={setModal}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal.kind === 'extend-trial' && (
        <ExtendTrialModal
          appId={appId}
          subscriptionId={modal.subscriptionId}
          onClose={closeModal}
          onSuccess={handleSuccess}
        />
      )}

      {modal.kind === 'cancel-trial' && (
        <ConfirmActionModal
          title={t('subscriptionActionsCancelTrial')}
          description={t('subscriptionActionsConfirmCancelTrial')}
          onClose={closeModal}
          onConfirm={async () => {
            await axiosPortal().delete(
              `/portal/apps/${appId}/subscriptions/${modal.subscriptionId}/trial`,
            )
            handleSuccess()
          }}
        />
      )}

      {modal.kind === 'create-trial' && (
        <CreateTrialModal
          appId={modal.appId}
          onClose={closeModal}
          onSuccess={handleSuccess}
        />
      )}

      {modal.kind === 'create-subscription' && (
        <ConfirmActionModal
          title={t('subscriptionActionsCreateSubscription')}
          description={t('subscriptionActionsConfirmCreateSubscription')}
          onClose={closeModal}
          onConfirm={async () => {
            await axiosPortal().post(
              `/portal/apps/${modal.appId}/subscriptions`,
              { connectorQuantity: 1 },
            )
            handleSuccess()
          }}
        />
      )}

      {modal.kind === 'cancel-subscription' && (
        <ConfirmActionModal
          title={t('subscriptionActionsCancelSubscription')}
          description={t('subscriptionActionsConfirmCancelSubscription')}
          onClose={closeModal}
          onConfirm={async () => {
            await axiosPortal().post(
              `/portal/apps/${appId}/subscriptions/${modal.subscriptionId}/cancel`,
            )
            handleSuccess()
          }}
        />
      )}
    </>
  )
}
