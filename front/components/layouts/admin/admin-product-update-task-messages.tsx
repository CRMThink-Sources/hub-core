'use client'

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Info, Loader2, RefreshCw, Send, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FieldLabel } from '@/components/ui/field'
import {
  getTaskMessages,
  groupTaskMessages,
  readProductUpdateError,
  sendTaskMessage,
  taskMessageAuthor,
  TASK_MESSAGE_MAX,
  validateTaskMessage,
  type TaskMessagesResponse,
} from '@/lib/portal-product-updates'
import { useProductUpdateErrorText } from './admin-product-update-errors'
import { AdminPanel } from './ui/admin-panel'

const NAMESPACE = 'admin/product-updates'
/** Mostra o contador só perto do limite, para não poluir o caso comum. */
const COUNTER_FROM = Math.floor(TASK_MESSAGE_MAX * 0.9)

type Props = {
  productUpdateId: string
  taskId: number
  /** Outra ação da novidade em andamento: o envio daqui espera. */
  disabled?: boolean
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: TaskMessagesResponse }

/**
 * Conversa da tarefa do Bitrix vinculada: as últimas 50 mensagens, da mais antiga
 * para a mais nova, e um campo para escrever. Não faz polling: a lista recarrega ao
 * abrir, ao trocar de tarefa, ao enviar e pelo botão de atualizar.
 */
export function AdminProductUpdateTaskMessages({
  productUpdateId,
  taskId,
  disabled = false,
}: Props) {
  const { t, i18n } = useTranslation(NAMESPACE)
  const errorText = useProductUpdateErrorText()
  const inputId = useId()
  const hintId = useId()
  const listRef = useRef<HTMLDivElement>(null)
  const requestRef = useRef(0)
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [refreshing, setRefreshing] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [syncOff, setSyncOff] = useState(false)
  const [scrollTick, setScrollTick] = useState(0)

  const describe = useCallback(
    (error: unknown) => {
      const info = readProductUpdateError(error)
      if (info.reason === 'task-not-found') {
        return {
          info,
          message: t('task.messages.taskNotFound'),
          detail: undefined,
        }
      }
      return { info, ...errorText(info) }
    },
    [errorText, t],
  )

  const load = useCallback(
    async (initial: boolean) => {
      const request = ++requestRef.current
      if (initial) setState({ status: 'loading' })
      else setRefreshing(true)
      try {
        const data = await getTaskMessages(productUpdateId)
        if (request !== requestRef.current) return
        setState({ status: 'ready', data })
        setScrollTick(tick => tick + 1)
      } catch (error) {
        if (request !== requestRef.current) return
        setState({ status: 'error', message: describe(error).message })
      } finally {
        if (request === requestRef.current) setRefreshing(false)
      }
    },
    [describe, productUpdateId],
  )

  // Troca de novidade ou de tarefa: outra conversa, outro rascunho.
  useEffect(() => {
    setDraft('')
    setSyncOff(false)
    void load(true)
    return () => {
      requestRef.current++
    }
  }, [taskId, productUpdateId, load])

  // Mais nova embaixo, à vista depois de cada carga.
  useLayoutEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [scrollTick])

  const validation = validateTaskMessage(draft)
  const overLimit = draft.trim().length > TASK_MESSAGE_MAX
  const canSend = validation.ok && !sending && !disabled && !syncOff

  const send = async () => {
    if (!validation.ok || !canSend) return
    setSending(true)
    try {
      await sendTaskMessage(productUpdateId, validation.text)
      setDraft('')
      toast.success(t('task.messages.sent'))
      await load(false)
    } catch (error) {
      const { info, message, detail } = describe(error)
      if (info.reason === 'tasks-sync-disabled') setSyncOff(true)
      toast.error(message, { description: detail })
    } finally {
      setSending(false)
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      void send()
    }
  }

  const groups =
    state.status === 'ready'
      ? groupTaskMessages(state.data.messages, i18n.language)
      : []

  return (
    <AdminPanel
      title={t('task.messages.title')}
      action={
        <Button
          variant="outline"
          size="sm"
          aria-label={t('task.messages.refresh')}
          disabled={state.status === 'loading' || refreshing}
          onClick={() => void load(false)}
        >
          <RefreshCw
            aria-hidden
            className={`size-3.5 ${refreshing ? 'motion-safe:animate-spin' : ''}`}
          />
        </Button>
      }
      bodyClassName="space-y-3"
    >
      <p className="text-sm text-muted-foreground">
        {t('task.messages.description')}
      </p>

      {state.status === 'ready' && state.data.mode === 'comments' && (
        <p className="text-xs text-muted-foreground">
          {t('task.messages.commentsMode')}
        </p>
      )}

      <div
        ref={listRef}
        role="log"
        aria-label={t('task.messages.listLabel')}
        aria-busy={state.status === 'loading' || refreshing}
        className="max-h-[32rem] min-h-64 overflow-y-auto rounded-md lg:min-h-[32rem] border border-border bg-muted/30 px-3 py-2"
      >
        {state.status === 'loading' && (
          <div role="status" className="space-y-3 py-1">
            <span className="sr-only">{t('task.messages.loading')}</span>
            {[0, 1, 2].map(row => (
              <div key={row} aria-hidden className="space-y-1.5">
                <div className="h-3 w-32 motion-safe:animate-pulse rounded bg-muted" />
                <div className="h-3 w-full motion-safe:animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        )}

        {state.status === 'error' && (
          <div role="alert" className="space-y-2 py-2">
            <p className="flex items-start gap-2 text-sm text-destructive">
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>
                <span className="font-medium">
                  {t('task.messages.loadErrorTitle')}
                </span>
                <span className="block text-muted-foreground">
                  {state.message}
                </span>
              </span>
            </p>
            <Button variant="outline" size="sm" onClick={() => void load(true)}>
              <RefreshCw aria-hidden className="size-3.5" />
              {t('task.messages.retry')}
            </Button>
          </div>
        )}

        {state.status === 'ready' && groups.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {t('task.messages.empty')}
          </p>
        )}

        {groups.map(group => (
          <div key={group.key} className="py-1">
            <p className="my-1 text-center text-xs text-muted-foreground tabular-nums">
              {group.label}
            </p>
            <ul className="space-y-2">
              {group.messages.map(message => {
                const author = taskMessageAuthor(message)
                const name =
                  author.kind === 'name'
                    ? author.name
                    : author.kind === 'id'
                      ? t('task.messages.unknownUser', { id: author.id })
                      : t('task.messages.system')
                return (
                  <li
                    key={message.id}
                    className={
                      message.isSystem
                        ? 'text-xs text-muted-foreground italic'
                        : 'rounded-md bg-card px-3 py-2 text-sm shadow-xs'
                    }
                  >
                    <p
                      className={
                        message.isSystem
                          ? 'tabular-nums'
                          : 'flex items-baseline gap-2 text-xs text-muted-foreground tabular-nums'
                      }
                    >
                      {message.isSystem ? (
                        <>
                          {t('task.messages.system')} · {message.timeLabel}
                        </>
                      ) : (
                        <>
                          <span className="font-medium text-foreground">
                            {name}
                          </span>
                          <span>{message.timeLabel}</span>
                        </>
                      )}
                    </p>
                    <p
                      className={
                        message.isSystem
                          ? 'break-words whitespace-pre-wrap'
                          : 'mt-1 break-words whitespace-pre-wrap text-foreground'
                      }
                    >
                      {message.text}
                    </p>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>

      {syncOff && (
        <p
          role="note"
          className="flex items-start gap-2 rounded-md bg-status-warning-soft px-3 py-2 text-sm text-status-warning-ink"
        >
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t('task.messages.syncOff')}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor={inputId}>
          {t('task.messages.inputLabel')}
        </FieldLabel>
        <textarea
          id={inputId}
          value={draft}
          rows={5}
          name="task-message"
          autoComplete="off"
          disabled={sending || syncOff}
          aria-describedby={hintId}
          aria-invalid={overLimit || undefined}
          placeholder={t('task.messages.inputPlaceholder')}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          className="min-h-28 w-full resize-y rounded-md border border-input bg-transparent px-2.5 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30"
        />
        <div className="flex items-center justify-between gap-3">
          <p id={hintId} className="text-xs text-muted-foreground">
            {t('task.messages.inputHint')}
            {draft.trim().length >= COUNTER_FROM && (
              <span
                className={`ml-2 tabular-nums ${overLimit ? 'font-medium text-destructive' : ''}`}
              >
                {t('task.messages.counter', {
                  count: draft.trim().length,
                  max: TASK_MESSAGE_MAX,
                })}
              </span>
            )}
          </p>
          <Button size="sm" disabled={!canSend} onClick={() => void send()}>
            {sending ? (
              <Loader2
                aria-hidden
                className="size-3.5 motion-safe:animate-spin"
              />
            ) : (
              <Send aria-hidden className="size-3.5" />
            )}
            {sending ? t('task.messages.sending') : t('task.messages.send')}
          </Button>
        </div>
      </div>
    </AdminPanel>
  )
}
