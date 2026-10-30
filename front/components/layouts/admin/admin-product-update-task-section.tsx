'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Info,
  Link2,
  Link2Off,
  Loader2,
  Plus,
  TriangleAlert,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Combobox,
  ComboboxContent,
  ComboboxItem,
  ComboboxTrigger,
  type ComboboxOption,
} from '@/components/ui/combobox'
import { FieldLabel } from '@/components/ui/field'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatPortalDate } from '@/lib/format-date'
import {
  createProductUpdateTask,
  linkProductUpdateTask,
  searchCrmthinkTasks,
  searchCrmthinkUsers,
  unlinkProductUpdateTask,
  type CrmthinkTaskSearchResult,
  type CrmthinkUser,
  type ProductUpdateView,
} from '@/lib/portal-product-updates'
import {
  BITRIX_TASK_STATUS,
  STATUS_NAMESPACE,
  statusMeta,
} from '@/lib/portal-status'
import { useProductUpdateErrorToast } from './admin-product-update-errors'
import { AdminProductUpdateTaskMessages } from './admin-product-update-task-messages'
import { AdminPanel } from './ui/admin-panel'
import { AdminStatusBadge } from './ui/admin-status-badge'

const NAMESPACE = 'admin/product-updates'
const SEARCH_DEBOUNCE_MS = 300

type Props = {
  view: ProductUpdateView
  /** Outra ação da novidade em andamento: os botões daqui esperam. */
  disabled: boolean
  onBusyChange: (busy: boolean) => void
  onChange: (view: ProductUpdateView) => void
}

/**
 * Bloco "Tarefa no Bitrix" da edição: a tarefa vinculada com o status em cache, ou
 * as duas formas de vincular — buscar uma existente ou criar uma nova no projeto.
 */
export function AdminProductUpdateTaskSection({
  view,
  disabled,
  onBusyChange,
  onChange,
}: Props) {
  const { t } = useTranslation(NAMESPACE)
  const showError = useProductUpdateErrorToast()
  const [busy, setBusy] = useState(false)

  const run = async (
    action: () => Promise<ProductUpdateView>,
    success: (updated: ProductUpdateView) => string,
  ) => {
    setBusy(true)
    onBusyChange(true)
    try {
      const updated = await action()
      onChange(updated)
      toast.success(success(updated))
    } catch (error) {
      showError(error)
    } finally {
      setBusy(false)
      onBusyChange(false)
    }
  }

  const locked = disabled || busy

  return (
    <AdminPanel title={t('task.title')}>
      <p className="text-sm text-muted-foreground">{t('task.description')}</p>

      {view.task ? (
        <LinkedTask
          view={view}
          busy={locked}
          onUnlink={() =>
            void run(
              () => unlinkProductUpdateTask(view.id),
              () => t('result.taskUnlinked'),
            )
          }
        />
      ) : (
        <Tabs defaultValue="link" className="mt-4">
          <TabsList aria-label={t('task.modeLabel')} className="w-full">
            <TabsTrigger value="link">
              <Link2 aria-hidden />
              {t('task.linkExisting')}
            </TabsTrigger>
            <TabsTrigger value="create">
              <Plus aria-hidden />
              {t('task.createNew')}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="link" className="mt-3">
            <LinkTaskForm
              busy={locked}
              onLink={task =>
                run(
                  () => linkProductUpdateTask(view.id, task.id),
                  () => t('result.taskLinked', { id: task.id }),
                )
              }
            />
          </TabsContent>
          <TabsContent value="create" className="mt-3">
            <CreateTaskForm
              busy={locked}
              onCreate={user =>
                run(
                  () => createProductUpdateTask(view.id, user.id),
                  updated =>
                    t('result.taskCreated', { id: updated.task?.id ?? '' }),
                )
              }
            />
          </TabsContent>
        </Tabs>
      )}
    </AdminPanel>
  )
}

function LinkedTask({
  view,
  busy,
  onUnlink,
}: {
  view: ProductUpdateView
  busy: boolean
  onUnlink: () => void
}) {
  const { t, i18n } = useTranslation(NAMESPACE)
  const { t: tStatus } = useTranslation(STATUS_NAMESPACE)
  const task = view.task
  if (!task) return null

  const status =
    task.status === null
      ? null
      : statusMeta(BITRIX_TASK_STATUS, String(task.status))

  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-md border border-border px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground tabular-nums">
              {t('task.linked', { id: task.id })}
            </p>
            <p className="mt-0.5 text-sm break-words text-muted-foreground">
              {task.title || t('task.untitled')}
            </p>
          </div>
          {status && (
            <AdminStatusBadge tone={status.tone}>
              {tStatus(status.labelKey)}
            </AdminStatusBadge>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground tabular-nums">
          {task.syncedAt
            ? t('task.syncedAt', {
                when: formatPortalDate(task.syncedAt, i18n.language),
              })
            : t('task.notSynced')}
        </p>
      </div>

      {task.awaitingApproval && (
        <p
          role="note"
          className="flex items-start gap-2 rounded-md bg-status-warning-soft px-3 py-2 text-sm text-status-warning-ink"
        >
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t('task.awaitingApproval')}
        </p>
      )}

      <Button variant="outline" size="sm" disabled={busy} onClick={onUnlink}>
        <Link2Off aria-hidden className="size-3.5" />
        {t('task.unlink')}
      </Button>

      <AdminProductUpdateTaskMessages
        productUpdateId={view.id}
        taskId={task.id}
        disabled={busy}
      />
    </div>
  )
}

function LinkTaskForm({
  busy,
  onLink,
}: {
  busy: boolean
  onLink: (task: CrmthinkTaskSearchResult) => Promise<void>
}) {
  const { t } = useTranslation(NAMESPACE)
  const { t: tStatus } = useTranslation(STATUS_NAMESPACE)
  const [selected, setSelected] = useState<CrmthinkTaskSearchResult | null>(
    null,
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1.5">
        <FieldLabel id="product-update-task-label">
          {t('task.searchLabel')}
        </FieldLabel>
        <AsyncSearchCombobox<CrmthinkTaskSearchResult>
          labelId="product-update-task-label"
          hintId="product-update-task-hint"
          placeholder={t('task.searchPlaceholder')}
          inputPlaceholder={t('task.searchInput')}
          minLength={1}
          search={searchCrmthinkTasks}
          keyOf={task => String(task.id)}
          labelOf={task => `#${task.id} · ${task.title}`}
          value={selected}
          onChange={setSelected}
          texts={{
            typeToSearch: t('task.typeToSearch'),
            searching: t('task.searching'),
            noResults: t('task.noResults'),
            error: t('task.searchError'),
          }}
          renderItem={task => (
            <>
              <span className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 font-medium tabular-nums">
                  #{task.id}
                </span>
                <span className="min-w-0 truncate">{task.title}</span>
              </span>
              <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                {tStatus(
                  statusMeta(BITRIX_TASK_STATUS, String(task.status)).labelKey,
                )}
                {task.responsibleName && (
                  <span>
                    · {t('task.responsible', { name: task.responsibleName })}
                  </span>
                )}
                {task.outsideGroup && (
                  <span className="text-status-warning-ink">
                    · {t('task.outsideGroup')}
                  </span>
                )}
              </span>
            </>
          )}
        />
        <p
          id="product-update-task-hint"
          className="text-xs text-muted-foreground"
        >
          {t('task.searchHint')}
        </p>
      </div>

      {selected?.outsideGroup && (
        <p
          role="note"
          className="flex items-start gap-2 rounded-md bg-status-warning-soft px-3 py-2 text-sm text-status-warning-ink"
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t('task.outsideGroupWarning')}
        </p>
      )}

      <Button
        size="sm"
        disabled={busy || !selected}
        onClick={() => {
          if (selected) void onLink(selected)
        }}
      >
        {busy ? (
          <Loader2 aria-hidden className="size-3.5 motion-safe:animate-spin" />
        ) : (
          <Link2 aria-hidden className="size-3.5" />
        )}
        {t('task.link')}
      </Button>
    </div>
  )
}

function CreateTaskForm({
  busy,
  onCreate,
}: {
  busy: boolean
  onCreate: (user: CrmthinkUser) => Promise<void>
}) {
  const { t } = useTranslation(NAMESPACE)
  const [responsible, setResponsible] = useState<CrmthinkUser | null>(null)

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1.5">
        <FieldLabel id="product-update-responsible-label">
          {t('task.responsibleLabel')}
        </FieldLabel>
        <AsyncSearchCombobox<CrmthinkUser>
          labelId="product-update-responsible-label"
          hintId="product-update-create-hint"
          placeholder={t('task.responsiblePlaceholder')}
          inputPlaceholder={t('task.responsibleInput')}
          minLength={2}
          search={searchCrmthinkUsers}
          keyOf={user => String(user.id)}
          labelOf={user => user.name}
          value={responsible}
          onChange={setResponsible}
          texts={{
            typeToSearch: t('task.typeToSearchUsers'),
            searching: t('task.searching'),
            noResults: t('task.noUsers'),
            error: t('task.searchError'),
          }}
          renderItem={user => (
            <>
              <span className="truncate">{user.name}</span>
              {user.email && (
                <span className="truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
              )}
            </>
          )}
        />
        <p
          id="product-update-create-hint"
          className="text-xs text-muted-foreground"
        >
          {t('task.createHint')}
        </p>
      </div>

      <Button
        size="sm"
        disabled={busy || !responsible}
        onClick={() => {
          if (responsible) void onCreate(responsible)
        }}
      >
        {busy ? (
          <Loader2 aria-hidden className="size-3.5 motion-safe:animate-spin" />
        ) : (
          <Plus aria-hidden className="size-3.5" />
        )}
        {t('task.create')}
      </Button>
    </div>
  )
}

type SearchState<T> =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; items: T[] }
  | { kind: 'error' }

/**
 * Combobox com busca no servidor: o termo espera `SEARCH_DEBOUNCE_MS` parado antes de
 * consultar, e resposta de um termo antigo é descartada. O filtro interno do
 * Combobox fica desligado (`filter={null}`): a lista é o que a api devolveu.
 */
function AsyncSearchCombobox<T>({
  labelId,
  hintId,
  placeholder,
  inputPlaceholder,
  minLength,
  search,
  keyOf,
  labelOf,
  renderItem,
  value,
  onChange,
  texts,
}: {
  labelId: string
  hintId: string
  placeholder: string
  inputPlaceholder: string
  minLength: number
  search: (query: string) => Promise<T[]>
  keyOf: (item: T) => string
  labelOf: (item: T) => string
  renderItem: (item: T) => ReactNode
  value: T | null
  onChange: (item: T | null) => void
  texts: {
    typeToSearch: string
    searching: string
    noResults: string
    error: string
  }
}) {
  const [query, setQuery] = useState('')
  const [state, setState] = useState<SearchState<T>>({ kind: 'idle' })

  useEffect(() => {
    const term = query.trim()
    if (term.length < minLength) {
      setState({ kind: 'idle' })
      return
    }
    let cancelled = false
    setState({ kind: 'loading' })
    const handle = setTimeout(() => {
      search(term)
        .then(items => {
          if (!cancelled) setState({ kind: 'ready', items })
        })
        .catch(() => {
          if (!cancelled) setState({ kind: 'error' })
        })
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [query, minLength, search])

  const results = useMemo(
    () => (state.kind === 'ready' ? state.items : []),
    [state],
  )
  const byKey = useMemo(
    () => new Map(results.map(item => [keyOf(item), item])),
    [results, keyOf],
  )
  const options = useMemo<ComboboxOption[]>(
    () => results.map(item => ({ value: keyOf(item), label: labelOf(item) })),
    [results, keyOf, labelOf],
  )
  const selected: ComboboxOption | null = value
    ? { value: keyOf(value), label: labelOf(value) }
    : null

  const emptyText =
    state.kind === 'loading'
      ? texts.searching
      : state.kind === 'error'
        ? texts.error
        : state.kind === 'ready'
          ? texts.noResults
          : texts.typeToSearch

  return (
    <Combobox
      items={options}
      filter={null}
      value={selected}
      isItemEqualToValue={(item, current) => item.value === current.value}
      onValueChange={(option: ComboboxOption | null) =>
        onChange(option ? (byKey.get(option.value) ?? null) : null)
      }
      onInputValueChange={(next, details) => {
        if (
          details.reason === 'input-change' ||
          details.reason === 'input-clear'
        )
          setQuery(next)
      }}
    >
      <ComboboxTrigger
        aria-labelledby={labelId}
        aria-describedby={hintId}
        placeholder={placeholder}
      />
      <ComboboxContent
        searchPlaceholder={inputPlaceholder}
        emptyText={emptyText}
      >
        {(option: ComboboxOption) => {
          const item = byKey.get(option.value)
          return (
            <ComboboxItem key={option.value} value={option}>
              {item ? renderItem(item) : option.label}
            </ComboboxItem>
          )
        }}
      </ComboboxContent>
    </Combobox>
  )
}
