'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { axiosPortal } from '@/infra/client/axios-portal'

type ImbotActionResult = {
  result: string
}

type SectionState =
  | { kind: 'idle' }
  | { kind: 'loading-register' }
  | { kind: 'loading-delete' }
  | { kind: 'confirming-delete' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string }

function resolveRegisterMessage(
  result: string,
  t: (key: string) => string,
): string {
  if (result === 'created') return t('imbotResultCreated')
  if (result === 'updated') return t('imbotResultUpdated')
  return t('imbotResultSkipped')
}

function resolveDeleteMessage(
  result: string,
  t: (key: string) => string,
): string {
  if (result === 'not_found') return t('imbotResultNotFound')
  return t('imbotResultDeleted')
}

function resolveApiError(err: unknown, t: (key: string) => string): string {
  const apiError = (
    err as { response?: { data?: { result?: { error?: string } } } }
  )?.response?.data?.result?.error

  if (typeof apiError === 'string') {
    if (apiError.toLowerCase().includes('not installed')) {
      return t('imbotErrorNotInstalled')
    }
    if (apiError.toLowerCase().includes('credential')) {
      return t('imbotErrorCredential')
    }
  }

  return t('imbotErrorGeneric')
}

type Props = {
  appId: string
}

export function AdminClientImbotSection({ appId }: Props) {
  const { t } = useTranslation('admin/client-detail')
  const [state, setState] = useState<SectionState>({ kind: 'idle' })

  async function handleRegister() {
    setState({ kind: 'loading-register' })
    try {
      const output = await axiosPortal().post<ImbotActionResult>(
        `/portal/apps/${appId}/audio-imbot`,
      )
      setState({
        kind: 'success',
        message: resolveRegisterMessage(output.result, t),
      })
    } catch (err) {
      setState({ kind: 'error', message: resolveApiError(err, t) })
    }
  }

  async function handleDelete() {
    setState({ kind: 'loading-delete' })
    try {
      const output = await axiosPortal().delete<ImbotActionResult>(
        `/portal/apps/${appId}/audio-imbot`,
      )
      setState({
        kind: 'success',
        message: resolveDeleteMessage(output.result, t),
      })
    } catch (err) {
      setState({ kind: 'error', message: resolveApiError(err, t) })
    }
  }

  const isLoading =
    state.kind === 'loading-register' || state.kind === 'loading-delete'

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium text-foreground">{t('imbotTitle')}</h2>

      <div className="admin-card p-6">
        <p className="mb-6 text-sm text-muted-foreground">
          {t('imbotDescription')}
        </p>

        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => {
              void handleRegister()
            }}
            disabled={isLoading}
          >
            {state.kind === 'loading-register' ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t('imbotRegistering')}
              </>
            ) : (
              t('imbotRegister')
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
                {t('imbotDeleteConfirm')}
              </Button>
              <Button
                variant="outline"
                onClick={() => setState({ kind: 'idle' })}
                disabled={isLoading}
              >
                {t('imbotDeleteCancel')}
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
                  {t('imbotDeleting')}
                </>
              ) : (
                t('imbotDelete')
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
    </div>
  )
}
