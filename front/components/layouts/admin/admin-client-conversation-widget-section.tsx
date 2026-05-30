'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { axiosPortal } from '@/infra/client/axios-portal'
import {
  resolveDeleteMessage,
  resolveDeploymentApiError,
  resolveRegisterMessage,
} from './admin-deployment.helpers'

type ActionResult = {
  result: string
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
}

export function AdminClientConversationWidgetSection({ appId }: Props) {
  const { t } = useTranslation('admin/app-settings')
  const keyPrefix = 'conversationWidget'
  const [state, setState] = useState<SectionState>({ kind: 'idle' })

  async function handleRegister() {
    setState({ kind: 'loading-register' })
    try {
      const output = await axiosPortal().post<ActionResult>(
        `/portal/apps/${appId}/conversation-widget`,
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

  async function handleDelete() {
    setState({ kind: 'loading-delete' })
    try {
      const output = await axiosPortal().delete<ActionResult>(
        `/portal/apps/${appId}/conversation-widget`,
      )
      setState({
        kind: 'success',
        message: resolveDeleteMessage(output.result, t, keyPrefix),
      })
    } catch (err) {
      setState({
        kind: 'error',
        message: resolveDeploymentApiError(err, t, keyPrefix),
      })
    }
  }

  const isLoading =
    state.kind === 'loading-register' || state.kind === 'loading-delete'

  return (
    <div className="admin-card p-6">
      <h3 className="text-base font-medium text-foreground">
        {t('conversationWidgetTitle')}
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        {t('conversationWidgetDescription')}
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button
          onClick={() => {
            void handleRegister()
          }}
          disabled={isLoading}
        >
          {state.kind === 'loading-register' ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {t('conversationWidgetRegistering')}
            </>
          ) : (
            t('conversationWidgetRegister')
          )}
        </Button>

        {state.kind === 'confirming-delete' ? (
          <>
            <Button
              variant="destructive"
              onClick={() => {
                void handleDelete()
              }}
              disabled={isLoading}
            >
              {t('conversationWidgetDeleteConfirm')}
            </Button>
            <Button
              variant="outline"
              onClick={() => setState({ kind: 'idle' })}
              disabled={isLoading}
            >
              {t('conversationWidgetDeleteCancel')}
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            onClick={() => setState({ kind: 'confirming-delete' })}
            disabled={isLoading}
            className="border-destructive text-destructive hover:bg-destructive/10"
          >
            {state.kind === 'loading-delete' ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t('conversationWidgetDeleting')}
              </>
            ) : (
              t('conversationWidgetDelete')
            )}
          </Button>
        )}
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
