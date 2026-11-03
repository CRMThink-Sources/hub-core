'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { axiosPortal } from '@/infra/client/axios-portal'
import {
  resolveDeploymentApiError,
  resolveMessageEventsMessage,
  resolveRegisterMessage,
} from './admin-deployment.helpers'

type ActionResult = {
  result: string
}

type MessageEventsResult = {
  connectorResult: string
}

type SectionState =
  | { kind: 'idle' }
  | { kind: 'loading-register' }
  | { kind: 'loading-message-events' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string }

type Props = {
  appId: string
}

/**
 * Registra o conector e religa os eventos de edição e exclusão de mensagem. Não há
 * botão de excluir porque desregistrar o conector derruba todas as linhas conectadas
 * ao Contact Center do portal.
 */
export function AdminClientConnectorSection({ appId }: Props) {
  const { t } = useTranslation('admin/app-settings')
  const keyPrefix = 'connector'
  const [state, setState] = useState<SectionState>({ kind: 'idle' })

  async function handleRegister() {
    setState({ kind: 'loading-register' })
    try {
      const output = await axiosPortal().post<ActionResult>(
        `/portal/apps/${appId}/connector`,
      )
      setState({
        kind: 'success',
        message: resolveRegisterMessage(output.result, t, keyPrefix),
      })
    } catch (err) {
      setState({
        kind: 'error',
        message: resolveDeploymentApiError(err, t, keyPrefix),
      })
    }
  }

  async function handleBindMessageEvents() {
    setState({ kind: 'loading-message-events' })
    try {
      const output = await axiosPortal().post<MessageEventsResult>(
        `/portal/apps/${appId}/message-events`,
      )
      setState({
        kind: 'success',
        message: resolveMessageEventsMessage(
          output.connectorResult,
          t,
          'messageEvents',
        ),
      })
    } catch (err) {
      setState({
        kind: 'error',
        message: resolveDeploymentApiError(err, t, 'messageEvents'),
      })
    }
  }

  const isRegistering = state.kind === 'loading-register'
  const isBinding = state.kind === 'loading-message-events'
  const isLoading = isRegistering || isBinding

  return (
    <div className="admin-card p-6">
      <h3 className="text-base font-medium text-foreground">
        {t('connectorTitle')}
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        {t('connectorDescription')}
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button
          onClick={() => {
            void handleRegister()
          }}
          disabled={isLoading}
        >
          {isRegistering ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {t('connectorRegistering')}
            </>
          ) : (
            t('connectorRegister')
          )}
        </Button>
      </div>

      <h4 className="mt-8 text-sm font-medium text-foreground">
        {t('messageEventsTitle')}
      </h4>
      <p className="mt-2 text-sm text-muted-foreground">
        {t('messageEventsDescription')}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          variant="outline"
          onClick={() => {
            void handleBindMessageEvents()
          }}
          disabled={isLoading}
        >
          {isBinding ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {t('messageEventsBinding')}
            </>
          ) : (
            t('messageEventsBind')
          )}
        </Button>
      </div>

      {state.kind === 'success' ? (
        <p className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          {state.message}
        </p>
      ) : null}

      {state.kind === 'error' ? (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.message}
        </p>
      ) : null}
    </div>
  )
}
