'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { axiosPortal } from '@/infra/client/axios-portal'
import {
  resolveDeploymentApiError,
  resolveRegisterMessage,
} from './admin-deployment.helpers'

type ActionResult = {
  result: string
}

type SectionState =
  | { kind: 'idle' }
  | { kind: 'loading-register' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string }

type Props = {
  appId: string
}

/**
 * Só registra: não há botão de excluir porque desregistrar o conector derruba
 * todas as linhas conectadas ao Contact Center do portal.
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

  const isLoading = state.kind === 'loading-register'

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
          {isLoading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {t('connectorRegistering')}
            </>
          ) : (
            t('connectorRegister')
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
