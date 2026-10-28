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
import { AdminClientSmsProviderSection } from './admin-client-sms-provider-section'
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
  const [localInstance, setLocalInstance] =
    useState<ThinkzapInstanceItem>(instance)

  /**
   * As ações são keyed pelo **item de assinatura**, como os event binds já eram.
   * Não há mais guard por existência de row: linha nascida na SPA — que é o caso das
   * linhas reais — tinha todas as ações escondidas, justamente onde o suporte precisa
   * atuar. Assinar e desassinar no provider ficam na aba Assinaturas, junto da
   * assinatura a que a linha pertence.
   *
   * Renomear é a única que depende de provider: a HubMessage não expõe escrita de nome
   * de canal.
   */
  const canRename = instance.provider === 'ZAPI'

  async function handleSaveName() {
    if (!name.trim() || !canRename) return
    setNameSave({ kind: 'saving' })
    try {
      await axiosPortal().patch(
        `/portal/apps/${appId}/thinkzap-lines/${instance.subscriptionItemId}/name`,
        { name: name.trim() },
      )
      setNameSave({ kind: 'saved' })
      setTimeout(() => setNameSave({ kind: 'idle' }), 2000)
    } catch {
      setNameSave({ kind: 'error', message: t('instanceModalNameError') })
    }
  }

  async function handleReactivate() {
    setReactivateState({ kind: 'loading' })
    try {
      await axiosPortal().patch(
        `/portal/apps/${appId}/thinkzap-lines/${instance.subscriptionItemId}/reactivate`,
        {},
      )
      setReactivateState({ kind: 'success' })
      setLocalInstance(prev => ({ ...prev, itemStatus: 'active' }))
      onUpdate({
        subscriptionItemId: instance.subscriptionItemId,
        itemStatus: 'active',
      })
    } catch {
      setReactivateState({
        kind: 'error',
        message: t('instanceModalReactivateError'),
      })
    }
  }

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

            {/* Name edit — só Z-API: a HubMessage não tem escrita de nome de canal. */}
            <div className={canRename ? 'mt-4' : 'hidden'}>
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
                  disabled={!name.trim() || nameSave.kind === 'saving'}
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

          {/* Reativar só faz sentido para item cancelado na SPA. */}
          {localInstance.itemStatus === 'cancelled' ? (
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

          {/* Provedor de mensagem da campanha de SMS do Bitrix — por linha, porque o
              `CODE` do sender deriva deste mesmo item de assinatura. */}
          <AdminClientSmsProviderSection
            appId={appId}
            subscriptionItemId={instance.subscriptionItemId}
            provider={instance.provider}
          />
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
