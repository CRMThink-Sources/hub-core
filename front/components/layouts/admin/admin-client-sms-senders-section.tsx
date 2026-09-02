'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Info, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { axiosPortal } from '@/infra/client/axios-portal'
import { resolveSmsProviderApiError } from './admin-sms-provider.helpers'

type RegisteredSmsSender = {
  code: string
  name: string | null
  subscriptionItemId: string | null
  lineName: string | null
  orphan: boolean
}

type SmsProviderLine = {
  subscriptionItemId: string
  name: string
  provider: string
  registered: boolean
}

type SmsProvidersResponse = {
  senders: RegisteredSmsSender[]
  lines: SmsProviderLine[]
}

type SectionState =
  | { kind: 'loading' }
  | { kind: 'ready'; data: SmsProvidersResponse }
  | { kind: 'error'; message: string }

/** A ação em curso, por chave de linha ou de sender — nunca duas ao mesmo tempo. */
type PendingAction =
  | { kind: 'register'; key: string }
  | { kind: 'remove'; key: string }
  | null

type Props = {
  appId: string
}

/**
 * Provedores de mensagem da campanha de SMS, por instalação.
 *
 * Mostra as **linhas** e os **senders**, e não só os senders, porque as duas metades são
 * necessárias para a tela ser operável. Só com os senders, um portal que ainda não
 * registrou nada abria numa lista vazia sem nenhuma ação — e a única forma de registrar
 * era saber, de fora, que ela mora dentro do modal da linha.
 *
 * O sender **órfão** é o caso que justificou a tela existir: `CODE` que não casa com
 * nenhuma linha continua na tela de campanha do cliente e faz toda campanha disparada
 * por ele falhar, destinatário por destinatário, sem explicação. Ele fica num bloco
 * próprio porque a ação dele é outra — remover pelo `CODE` cru, já que a linha que o
 * gerou não existe mais.
 */
export function AdminClientSmsSendersSection({ appId }: Props) {
  const { t } = useTranslation('admin/app-settings')
  const [state, setState] = useState<SectionState>({ kind: 'loading' })
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pending, setPending] = useState<PendingAction>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  /**
   * A leitura, com o payload normalizado na fronteira.
   *
   * As duas listas caem em `[]` quando a resposta não as traz: uma API mais antiga que
   * este bundle — deploy em andamento, ou processo de dev não reiniciado — devolve só
   * `senders`, e um `.length` sobre `undefined` derruba a página inteira em vez de
   * mostrar uma seção a menos.
   *
   * Uma função só, e não uma cópia no efeito e outra no refresh: era exatamente aí que
   * a normalização entraria num lugar e faltaria no outro.
   */
  const fetchProviders =
    useCallback(async (): Promise<SmsProvidersResponse> => {
      const output = await axiosPortal().get<Partial<SmsProvidersResponse>>(
        `/portal/apps/${appId}/sms-providers`,
      )

      return { senders: output.senders ?? [], lines: output.lines ?? [] }
    }, [appId])

  const load = useCallback(async () => {
    try {
      setState({ kind: 'ready', data: await fetchProviders() })
    } catch (err) {
      setState({ kind: 'error', message: resolveSmsProviderApiError(err, t) })
    }
  }, [fetchProviders, t])

  useEffect(() => {
    let cancelled = false

    setState({ kind: 'loading' })

    fetchProviders()
      .then(data => {
        if (!cancelled) setState({ kind: 'ready', data })
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            kind: 'error',
            message: resolveSmsProviderApiError(err, t),
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [fetchProviders, t])

  async function handleRefresh() {
    setIsRefreshing(true)
    setFeedback(null)
    await load()
    setIsRefreshing(false)
  }

  /** Registra ou converge o provedor de uma linha. */
  async function handleRegister(line: SmsProviderLine) {
    setPending({ kind: 'register', key: line.subscriptionItemId })
    setFeedback(null)
    try {
      const output = await axiosPortal().post<{ result: string }>(
        `/portal/apps/${appId}/thinkzap-lines/${line.subscriptionItemId}/sms-provider`,
      )
      setFeedback(
        output.result === 'created'
          ? t('smsProviderResultCreated')
          : output.result === 'updated'
            ? t('smsProviderResultUpdated')
            : t('smsProviderResultSkipped'),
      )
      await load()
    } catch (err) {
      setState({ kind: 'error', message: resolveSmsProviderApiError(err, t) })
    } finally {
      setPending(null)
    }
  }

  async function handleRemoveLine(line: SmsProviderLine) {
    setPending({ kind: 'remove', key: line.subscriptionItemId })
    setConfirming(null)
    setFeedback(null)
    try {
      const output = await axiosPortal().delete<{ result: string }>(
        `/portal/apps/${appId}/thinkzap-lines/${line.subscriptionItemId}/sms-provider`,
      )
      setFeedback(
        output.result === 'deleted'
          ? t('smsProviderResultDeleted')
          : t('smsProviderResultNotFound'),
      )
      await load()
    } catch (err) {
      setState({ kind: 'error', message: resolveSmsProviderApiError(err, t) })
    } finally {
      setPending(null)
    }
  }

  /** Órfão: não há item de onde derivar o `CODE`, então a remoção vai pelo `CODE` cru. */
  async function handleRemoveOrphan(code: string) {
    setPending({ kind: 'remove', key: code })
    setConfirming(null)
    setFeedback(null)
    try {
      await axiosPortal().delete(
        `/portal/apps/${appId}/sms-providers/${encodeURIComponent(code)}`,
      )
      setFeedback(t('smsProviderResultDeleted'))
      await load()
    } catch (err) {
      setState({ kind: 'error', message: resolveSmsProviderApiError(err, t) })
    } finally {
      setPending(null)
    }
  }

  const isBusy = pending !== null || isRefreshing

  const orphans =
    state.kind === 'ready'
      ? state.data.senders.filter(sender => sender.orphan)
      : []

  return (
    <div className="admin-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-medium text-foreground">
            {t('smsSendersTitle')}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('smsSendersDescription')}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void handleRefresh()
          }}
          disabled={isBusy || state.kind === 'loading'}
        >
          {isRefreshing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          {t('smsSendersRefresh')}
        </Button>
      </div>

      {/* O rótulo "SMS" é imposto pela API do Bitrix: o cliente procura WhatsApp no menu
          errado. Sempre visível. */}
      <p className="mt-4 flex gap-2 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:bg-blue-950 dark:text-blue-200">
        <Info className="mt-0.5 size-4 shrink-0" />
        {t('smsProviderLabelWarning')}
      </p>

      {state.kind === 'loading' ? (
        <p className="mt-4 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t('smsSendersLoading')}
        </p>
      ) : null}

      {state.kind === 'error' ? (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.message}
        </p>
      ) : null}

      {feedback ? (
        <p className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          {feedback}
        </p>
      ) : null}

      {state.kind === 'ready' ? (
        <>
          <h4 className="mt-6 text-sm font-semibold text-foreground">
            {t('smsSendersLinesTitle')}
          </h4>

          {state.data.lines.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {t('smsSendersNoLines')}
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {state.data.lines.map(line => {
                const key = line.subscriptionItemId
                const isRemoving =
                  pending?.kind === 'remove' && pending.key === key
                const isRegistering =
                  pending?.kind === 'register' && pending.key === key

                return (
                  <li
                    key={key}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="text-foreground">{line.name}</p>
                      <p className="text-muted-foreground">
                        {line.registered
                          ? t('smsSendersStatusRegistered')
                          : t('smsSendersStatusNotRegistered')}
                        {line.provider === 'ZAPI' ? (
                          <span className="ml-2 inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                            <AlertTriangle className="size-3.5" />
                            {t('smsSendersBanHint')}
                          </span>
                        ) : null}
                      </p>
                    </div>

                    {confirming === key ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-foreground">
                          {t('smsProviderDeleteWarning')}
                        </span>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            void handleRemoveLine(line)
                          }}
                          disabled={isBusy}
                        >
                          {t('smsProviderDeleteConfirm')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setConfirming(null)}
                          disabled={isBusy}
                        >
                          {t('smsProviderDeleteCancel')}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant={line.registered ? 'outline' : 'default'}
                          onClick={() => {
                            void handleRegister(line)
                          }}
                          disabled={isBusy}
                        >
                          {isRegistering ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : null}
                          {line.registered
                            ? t('smsSendersReregister')
                            : t('smsProviderRegister')}
                        </Button>

                        {line.registered ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setConfirming(key)}
                            disabled={isBusy}
                            className="border-destructive text-destructive hover:bg-destructive/10"
                          >
                            {isRemoving ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : null}
                            {t('smsProviderDelete')}
                          </Button>
                        ) : null}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          {/* Órfãos em bloco próprio: a ação é outra, e o motivo de existirem é um
              problema, não um estado normal. */}
          {orphans.length > 0 ? (
            <>
              <h4 className="mt-6 text-sm font-semibold text-foreground">
                {t('smsSendersOrphansTitle')}
              </h4>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('smsSendersOrphansDescription')}
              </p>

              <ul className="mt-2 space-y-2">
                {orphans.map(sender => {
                  const isRemoving =
                    pending?.kind === 'remove' && pending.key === sender.code

                  return (
                    <li
                      key={sender.code}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-300 px-3 py-2 text-sm dark:border-amber-800"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-foreground">
                          {sender.code}
                        </p>
                        <p className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                          <AlertTriangle className="size-3.5" />
                          {t('smsSendersOrphan')}
                        </p>
                      </div>

                      {confirming === sender.code ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              void handleRemoveOrphan(sender.code)
                            }}
                            disabled={isBusy}
                          >
                            {t('smsSendersRemoveConfirm')}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setConfirming(null)}
                            disabled={isBusy}
                          >
                            {t('smsSendersRemoveCancel')}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setConfirming(sender.code)}
                          disabled={isBusy}
                          className="border-destructive text-destructive hover:bg-destructive/10"
                        >
                          {isRemoving ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : null}
                          {t('smsSendersRemove')}
                        </Button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
