'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Info, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { axiosPortal } from '@/infra/client/axios-portal'
import { resolveSmsProviderApiError } from './admin-sms-provider.helpers'

type ActionResult = {
  result: 'created' | 'updated' | 'skipped' | 'deleted'
}

type SectionState =
  | { kind: 'idle' }
  | { kind: 'loading-register' }
  | { kind: 'loading-delete' }
  | { kind: 'confirming-delete' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string }

type Props = {
  appId: string
  subscriptionItemId: string
  /** `ZAPI` | `HUBMESSAGE` — só o não oficial carrega risco de bloqueio do número. */
  provider: string
}

/**
 * Registrar/remover o provedor de mensagem **de uma linha** no Bitrix do cliente.
 *
 * Par registrar/remover no formato de `admin-client-bizproc-robot-section`, com a
 * confirmação na remoção — remover é o único caminho que tira o provedor da tela de
 * campanha do cliente, e não tem desfazer.
 */
export function AdminClientSmsProviderSection({
  appId,
  subscriptionItemId,
  provider,
}: Props) {
  const { t } = useTranslation('admin/app-settings')
  const [state, setState] = useState<SectionState>({ kind: 'idle' })

  const route = `/portal/apps/${appId}/thinkzap-lines/${subscriptionItemId}/sms-provider`

  async function handleRegister() {
    setState({ kind: 'loading-register' })
    try {
      const output = await axiosPortal().post<ActionResult>(route)
      setState({
        kind: 'success',
        message:
          output.result === 'created'
            ? t('smsProviderResultCreated')
            : output.result === 'updated'
              ? t('smsProviderResultUpdated')
              : t('smsProviderResultSkipped'),
      })
    } catch (err) {
      setState({ kind: 'error', message: resolveSmsProviderApiError(err, t) })
    }
  }

  async function handleDelete() {
    setState({ kind: 'loading-delete' })
    try {
      const output = await axiosPortal().delete<ActionResult>(route)
      setState({
        kind: 'success',
        message:
          output.result === 'deleted'
            ? t('smsProviderResultDeleted')
            : t('smsProviderResultNotFound'),
      })
    } catch (err) {
      setState({ kind: 'error', message: resolveSmsProviderApiError(err, t) })
    }
  }

  const isLoading =
    state.kind === 'loading-register' || state.kind === 'loading-delete'

  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold text-foreground">
        {t('smsProviderTitle')}
      </h3>
      <p className="text-sm text-muted-foreground">
        {t('smsProviderDescription')}
      </p>

      {/* O rótulo "SMS" é imposto pela API do Bitrix e o cliente procura WhatsApp no
          menu errado. Sempre visível, para qualquer provider. */}
      <p className="mt-3 flex gap-2 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:bg-blue-950 dark:text-blue-200">
        <Info className="mt-0.5 size-4 shrink-0" />
        {t('smsProviderLabelWarning')}
      </p>

      {/* Risco real de bloqueio do número pela Meta em disparo em massa por linha não
          oficial — e o número bloqueado derruba junto o atendimento 1:1 daquela linha.
          Avisa sem bloquear: a decisão é do cliente. */}
      {provider === 'ZAPI' ? (
        <p className="mt-2 flex gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {t('smsProviderBanWarning')}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => {
            void handleRegister()
          }}
          disabled={isLoading}
        >
          {state.kind === 'loading-register' ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {t('smsProviderRegistering')}
            </>
          ) : (
            t('smsProviderRegister')
          )}
        </Button>

        {state.kind === 'confirming-delete' ? (
          <>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                void handleDelete()
              }}
              disabled={isLoading}
            >
              {t('smsProviderDeleteConfirm')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setState({ kind: 'idle' })}
              disabled={isLoading}
            >
              {t('smsProviderDeleteCancel')}
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setState({ kind: 'confirming-delete' })}
            disabled={isLoading}
            className="border-destructive text-destructive hover:bg-destructive/10"
          >
            {state.kind === 'loading-delete' ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t('smsProviderDeleting')}
              </>
            ) : (
              t('smsProviderDelete')
            )}
          </Button>
        )}
      </div>

      {state.kind === 'confirming-delete' ? (
        <p className="mt-3 text-sm text-foreground">
          {t('smsProviderDeleteWarning')}
        </p>
      ) : null}

      {state.kind === 'success' ? (
        <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          {state.message}
        </p>
      ) : null}

      {state.kind === 'error' ? (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.message}
        </p>
      ) : null}
    </section>
  )
}
