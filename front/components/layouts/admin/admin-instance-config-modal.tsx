'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { axiosPortal } from '@/infra/client/axios-portal'
import type { ThinkzapInstanceItem } from './admin-client-instances-section'

type ReactivateState =
  | { kind: 'idle' }
  | { kind: 'confirming' }
  | { kind: 'loading' }
  | { kind: 'success' }
  | { kind: 'error'; message: string }

type NameSaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved' }
  | { kind: 'error'; message: string }

type SubscriptionState =
  | { kind: 'idle' }
  | { kind: 'confirming'; action: 'subscribe' | 'unsubscribe' }
  | { kind: 'loading' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string }

type EventSaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved' }
  | { kind: 'error'; message: string }

type Props = {
  appId: string
  instance: ThinkzapInstanceItem
  onClose: () => void
  onUpdate: (updated: Partial<ThinkzapInstanceItem>) => void
}

export function AdminInstanceConfigModal({
  appId,
  instance,
  onClose,
  onUpdate,
}: Props) {
  const { t } = useTranslation('admin/app-settings')
  const [name, setName] = useState('')
  const [nameSave, setNameSave] = useState<NameSaveState>({ kind: 'idle' })
  const [reactivateState, setReactivateState] = useState<ReactivateState>({
    kind: 'idle',
  })
  const [subscriptionState, setSubscriptionState] = useState<SubscriptionState>(
    { kind: 'idle' },
  )
  const [eventSave, setEventSave] = useState<Record<string, EventSaveState>>({})
  const [localInstance, setLocalInstance] =
    useState<ThinkzapInstanceItem>(instance)

  /**
   * Três ações ainda são keyed pelas tabelas antigas — renomear e assinar por
   * `Instance.id`, reativar por `Connector.id`. Linha criada direto na SPA não tem
   * essas rows, então o id vem `null` e a ação fica indisponível em vez de bater
   * numa URL com `null` no path. Só os event binds já são keyed pelo item.
   */
  const hasInstanceRow = instance.instanceDbId !== null
  const hasConnectorRow = instance.connectorId !== null

  async function handleSaveName() {
    if (!name.trim() || !hasInstanceRow) return
    setNameSave({ kind: 'saving' })
    try {
      await axiosPortal().patch(
        `/portal/apps/${appId}/thinkzap-instances/${instance.instanceDbId}/name`,
        { name: name.trim() },
      )
      setNameSave({ kind: 'saved' })
      setTimeout(() => setNameSave({ kind: 'idle' }), 2000)
    } catch {
      setNameSave({ kind: 'error', message: t('instanceModalNameError') })
    }
  }

  async function handleReactivate() {
    if (!hasConnectorRow) return
    setReactivateState({ kind: 'loading' })
    try {
      await axiosPortal().patch(
        `/portal/apps/${appId}/thinkzap-connectors/${instance.connectorId}/reactivate`,
        {},
      )
      setReactivateState({ kind: 'success' })
      setLocalInstance(prev => ({ ...prev, connectorStatus: 'ACTIVE' }))
      onUpdate({
        subscriptionItemId: instance.subscriptionItemId,
        connectorStatus: 'ACTIVE',
      })
    } catch {
      setReactivateState({
        kind: 'error',
        message: t('instanceModalReactivateError'),
      })
    }
  }

  async function handleSubscriptionAction(action: 'subscribe' | 'unsubscribe') {
    if (!hasInstanceRow) return
    setSubscriptionState({ kind: 'loading' })
    try {
      await axiosPortal().post(
        `/portal/apps/${appId}/thinkzap-instances/${instance.instanceDbId}/${action}`,
        {},
      )
      const message =
        action === 'subscribe'
          ? t('instanceModalSubscribeSuccess')
          : t('instanceModalUnsubscribeSuccess')
      setSubscriptionState({ kind: 'success', message })
    } catch {
      const message =
        action === 'subscribe'
          ? t('instanceModalSubscribeError')
          : t('instanceModalUnsubscribeError')
      setSubscriptionState({ kind: 'error', message })
    }
  }

  async function handleEventToggle(
    field: 'messageUpdateEventEnabled' | 'messageDeleteEventEnabled',
    value: boolean,
  ) {
    setEventSave(prev => ({ ...prev, [field]: { kind: 'saving' } }))
    try {
      // Keyed pelo item: os toggles vivem em `ufCrm93Settings`, não nas tabelas.
      await axiosPortal().patch(
        `/portal/apps/${appId}/thinkzap-lines/${instance.subscriptionItemId}/event-binds`,
        { [field]: value },
      )
      const updated = { ...localInstance, [field]: value }
      setLocalInstance(updated)
      onUpdate({
        subscriptionItemId: instance.subscriptionItemId,
        [field]: value,
      })
      setEventSave(prev => ({ ...prev, [field]: { kind: 'saved' } }))
      setTimeout(() => {
        setEventSave(prev => {
          const next = { ...prev }
          if (next[field]?.kind === 'saved') delete next[field]
          return next
        })
      }, 2000)
    } catch {
      setEventSave(prev => ({
        ...prev,
        [field]: { kind: 'error', message: t('connectorsErrorSave') },
      }))
      setTimeout(() => {
        setEventSave(prev => {
          const next = { ...prev }
          if (next[field]?.kind === 'error') delete next[field]
          return next
        })
      }, 3000)
    }
  }

  const isSavingAnyEvent = Object.values(eventSave).some(
    s => s.kind === 'saving',
  )

  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('instanceModalTitle')}</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-6">
          {/* Info section */}
          <section>
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              {t('instanceModalSectionInfo')}
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex gap-2">
                <dt className="w-36 shrink-0 text-muted-foreground">
                  {t('instanceModalInstanceId')}
                </dt>
                <dd className="font-mono text-foreground">
                  {localInstance.instanceId}
                </dd>
              </div>
              {localInstance.zapiName ? (
                <div className="flex gap-2">
                  <dt className="w-36 shrink-0 text-muted-foreground">
                    {t('instanceModalNameLabel')}
                  </dt>
                  <dd className="text-foreground">{localInstance.zapiName}</dd>
                </div>
              ) : null}
              {localInstance.vinculatedChannel ? (
                <div className="flex gap-2">
                  <dt className="w-36 shrink-0 text-muted-foreground">
                    {t('instanceModalVinculatedChannel')}
                  </dt>
                  <dd className="text-foreground">
                    {localInstance.vinculatedChannel}
                  </dd>
                </div>
              ) : null}
              {localInstance.zapiConnected !== null ? (
                <div className="flex gap-2">
                  <dt className="w-36 shrink-0 text-muted-foreground">
                    {t('instanceModalStatus')}
                  </dt>
                  <dd>
                    {localInstance.zapiConnected ? (
                      <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                        <span className="size-1.5 rounded-full bg-current" />
                        {t('instancesStatusConnected')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <span className="size-1.5 rounded-full bg-current" />
                        {t('instancesStatusDisconnected')}
                      </span>
                    )}
                  </dd>
                </div>
              ) : null}
              {localInstance.zapiPaymentStatus ? (
                <div className="flex gap-2">
                  <dt className="w-36 shrink-0 text-muted-foreground">
                    {t('instanceModalPaymentStatus')}
                  </dt>
                  <dd className="text-foreground">
                    {localInstance.zapiPaymentStatus}
                  </dd>
                </div>
              ) : null}
            </dl>

            {/* Name edit */}
            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-foreground">
                {t('instanceModalNameLabel')}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={t('instanceModalNamePlaceholder')}
                  className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={
                    !name.trim() ||
                    nameSave.kind === 'saving' ||
                    /* Renomear é operação na row antiga; linha da SPA não tem. */
                    !hasInstanceRow
                  }
                  onClick={() => {
                    void handleSaveName()
                  }}
                >
                  {nameSave.kind === 'saving' ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  {nameSave.kind === 'saving'
                    ? t('instanceModalNameSaving')
                    : t('instanceModalNameSave')}
                </Button>
              </div>
              {nameSave.kind === 'saved' ? (
                <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                  {t('instanceModalNameSaved')}
                </p>
              ) : null}
              {nameSave.kind === 'error' ? (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {nameSave.message}
                </p>
              ) : null}
            </div>
          </section>

          {/* <hr className="border-border" /> */}

          {/* Connector settings section */}
          {/* <section>
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              {t('instanceModalSectionConnector')}
            </h3>
            <div className="space-y-3">
              {(
                [
                  'messageUpdateEventEnabled',
                  'messageDeleteEventEnabled',
                ] as const
              ).map(field => {
                const save = eventSave[field]
                const labelKey =
                  field === 'messageUpdateEventEnabled'
                    ? 'connectorsMessageUpdateEvent'
                    : 'connectorsMessageDeleteEvent'
                const hintKey =
                  field === 'messageUpdateEventEnabled'
                    ? 'connectorsMessageUpdateEventHint'
                    : 'connectorsMessageDeleteEventHint'
                return (
                  <label
                    key={field}
                    className="flex cursor-pointer items-start gap-3"
                  >
                    <input
                      type="checkbox"
                      checked={localInstance[field]}
                      onChange={e => {
                        void handleEventToggle(field, e.target.checked)
                      }}
                      disabled={isSavingAnyEvent}
                      className="mt-0.5"
                    />
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-foreground">
                        {t(labelKey)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t(hintKey)}
                      </span>
                      {save?.kind === 'saving' ? (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Loader2 className="size-3 animate-spin" />
                          {t('connectorsSaving')}
                        </span>
                      ) : null}
                      {save?.kind === 'saved' ? (
                        <span className="text-xs text-green-600 dark:text-green-400">
                          {t('connectorsSaved')}
                        </span>
                      ) : null}
                      {save?.kind === 'error' ? (
                        <span className="text-xs text-red-600 dark:text-red-400">
                          {save.message}
                        </span>
                      ) : null}
                    </span>
                  </label>
                )
              })}
            </div>
          </section> */}

          {localInstance.connectorStatus === 'INACTIVE' ? (
            <>
              <hr className="border-border" />

              <section>
                <h3 className="mb-3 text-sm font-semibold text-foreground">
                  {t('instanceModalSectionReactivate')}
                </h3>

                {reactivateState.kind === 'success' ? (
                  <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
                    {t('instanceModalReactivateSuccess')}
                  </p>
                ) : reactivateState.kind === 'error' ? (
                  <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                    {reactivateState.message}
                  </p>
                ) : reactivateState.kind === 'confirming' ? (
                  <div className="space-y-3">
                    <p className="text-sm text-foreground">
                      {t('instanceModalReactivateConfirm')}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          void handleReactivate()
                        }}
                      >
                        {t('instanceModalConfirm')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setReactivateState({ kind: 'idle' })}
                      >
                        {t('instanceModalCancel')}
                      </Button>
                    </div>
                  </div>
                ) : reactivateState.kind === 'loading' ? (
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    {t('connectorsSaving')}
                  </p>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setReactivateState({ kind: 'confirming' })}
                  >
                    {t('instanceModalReactivate')}
                  </Button>
                )}
              </section>
            </>
          ) : null}

          <hr className="border-border" />

          {/* Subscription section */}
          <section>
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              {t('instanceModalSectionSubscription')}
            </h3>

            {/* Assinar e desassinar são operações na row antiga, keyed por
                `Instance.id`. Linha criada na SPA não tem, e a seção fica fora em vez
                de oferecer um botão que bateria numa URL com `null` no path. */}
            {!hasInstanceRow ? (
              <p className="text-sm text-muted-foreground">
                {t('instanceModalSubscriptionUnavailable')}
              </p>
            ) : null}

            {hasInstanceRow &&
            (subscriptionState.kind === 'idle' ||
              subscriptionState.kind === 'success' ||
              subscriptionState.kind === 'error') ? (
              <div className="space-y-3">
                {subscriptionState.kind === 'success' ? (
                  <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
                    {subscriptionState.message}
                  </p>
                ) : null}
                {subscriptionState.kind === 'error' ? (
                  <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                    {subscriptionState.message}
                  </p>
                ) : null}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setSubscriptionState({
                        kind: 'confirming',
                        action: 'subscribe',
                      })
                    }
                  >
                    {t('instanceModalSubscribe')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setSubscriptionState({
                        kind: 'confirming',
                        action: 'unsubscribe',
                      })
                    }
                  >
                    {t('instanceModalUnsubscribe')}
                  </Button>
                </div>
              </div>
            ) : null}

            {subscriptionState.kind === 'confirming' ? (
              <div className="space-y-3">
                <p className="text-sm text-foreground">
                  {subscriptionState.action === 'subscribe'
                    ? t('instanceModalSubscribeConfirm')
                    : t('instanceModalUnsubscribeConfirm')}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      void handleSubscriptionAction(subscriptionState.action)
                    }}
                  >
                    {t('instanceModalConfirm')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSubscriptionState({ kind: 'idle' })}
                  >
                    {t('instanceModalCancel')}
                  </Button>
                </div>
              </div>
            ) : null}

            {subscriptionState.kind === 'loading' ? (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {t('connectorsSaving')}
              </p>
            ) : null}
          </section>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('instanceModalClose')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
