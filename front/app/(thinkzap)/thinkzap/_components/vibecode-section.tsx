'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { isBitrixAdmin } from '@/bitrix'
import { useThinkzapAccess } from '@/app/hooks/use-thinkzap-permissions'
import {
  resolveThinkzapClient,
  thinkzapApiErrorMessage,
  type ThinkzapHttpClient,
} from '@/app/(thinkzap)/thinkzap/_lib/thinkzap-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type InsightsStatus = {
  mode: 'full' | 'lean'
  keyConfigured: boolean
  last4: string | null
  validatedAt: string | null
  keyProblem: 'revoked' | null
}

/**
 * Chave Vibecode do Insights. A chave nunca volta da API: só `last4` e a data
 * de validação. A mensagem de recusa (422) vem pronta do backend, que já diz
 * o que está errado na chave (escopo extra, portal diferente, etc.).
 */
export function VibecodeSection() {
  const { t, i18n } = useTranslation('thinkzap/administracao')
  const thinkzapAccess = useThinkzapAccess()
  const canManage = thinkzapAccess?.canManageAccess === true || isBitrixAdmin()

  const [status, setStatus] = useState<InsightsStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [keyValue, setKeyValue] = useState('')
  const [rejection, setRejection] = useState('')

  const getClient = useCallback((): ThinkzapHttpClient | null => {
    const resolved = resolveThinkzapClient()
    return resolved.ok ? resolved.client : null
  }, [])

  const load = useCallback(async () => {
    const client = getClient()
    if (!client) {
      toast.error(t('vibecode.loadError'))
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      setStatus(await client.get<InsightsStatus>('/thinkzap/insights/status'))
    } catch (error) {
      toast.error(thinkzapApiErrorMessage(error, t('vibecode.loadError')))
    } finally {
      setLoading(false)
    }
  }, [getClient, t])

  useEffect(() => {
    if (!canManage) return
    void load()
  }, [canManage, load])

  async function handleSave() {
    const client = getClient()
    if (!client) return
    if (!keyValue.trim()) {
      setRejection(t('vibecode.keyRequired'))
      return
    }
    setBusy(true)
    setRejection('')
    try {
      await client.put('/thinkzap/insights/vibecode-key', { key: keyValue })
      setKeyValue('')
      toast.success(t('vibecode.saved'))
      await load()
    } catch (error) {
      setRejection(thinkzapApiErrorMessage(error, t('vibecode.saveError')))
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove() {
    const client = getClient()
    if (!client) return
    setBusy(true)
    setRejection('')
    try {
      await client.delete('/thinkzap/insights/vibecode-key')
      toast.success(t('vibecode.removed'))
      await load()
    } catch (error) {
      toast.error(thinkzapApiErrorMessage(error, t('vibecode.removeError')))
    } finally {
      setBusy(false)
    }
  }

  if (!canManage) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {t('vibecode.adminOnly')}
      </p>
    )
  }

  const validatedDate = status?.validatedAt
    ? new Date(status.validatedAt).toLocaleDateString(i18n.language)
    : null

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">
          {t('vibecode.title')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('vibecode.description')}
        </p>

        <div className="mt-4 text-sm text-foreground">
          {loading ? (
            <span className="text-muted-foreground">
              {t('vibecode.loading')}
            </span>
          ) : status?.keyConfigured ? (
            <div className="grid gap-1">
              <span className="font-medium">
                {t('vibecode.statusConfigured', { last4: status.last4 ?? '' })}
              </span>
              {validatedDate ? (
                <span className="text-muted-foreground">
                  {t('vibecode.statusValidated', { date: validatedDate })}
                </span>
              ) : null}
            </div>
          ) : (
            <span className="text-muted-foreground">
              {t('vibecode.statusNone')}
            </span>
          )}
        </div>

        {status?.keyProblem === 'revoked' ? (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
          >
            {t('vibecode.revoked')}
          </p>
        ) : null}

        <label className="mt-6 grid gap-2">
          <span className="text-sm font-medium text-foreground">
            {t('vibecode.keyLabel')}
          </span>
          <Input
            type="password"
            value={keyValue}
            onChange={event => setKeyValue(event.target.value)}
            placeholder={t('vibecode.keyPlaceholder')}
            autoComplete="off"
          />
        </label>

        {rejection ? (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {rejection}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={busy}
            onClick={() => void handleSave()}
          >
            {busy ? t('vibecode.saving') : t('vibecode.save')}
          </Button>
          {status?.keyConfigured ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void handleRemove()}
            >
              {busy ? t('vibecode.removing') : t('vibecode.remove')}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
