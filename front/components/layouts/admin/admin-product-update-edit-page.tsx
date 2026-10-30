'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  AlertTriangle,
  ArrowLeft,
  CircleCheck,
  CircleDashed,
  ClipboardCheck,
  ImageOff,
  ImageUp,
  Loader2,
  MoreHorizontal,
  RotateCw,
  Save,
  SearchX,
  Send,
  Trash2,
  Undo2,
  EyeOff,
} from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ProductUpdateCard,
  type ProductUpdateCardLabels,
} from '@/components/product-updates/product-update-card'
import { formatPortalDate } from '@/lib/format-date'
import {
  CONFIRMED_ACTIONS,
  PRODUCT_UPDATE_DESCRIPTION_MAX,
  PRODUCT_UPDATE_IMAGE_TYPES,
  PRODUCT_UPDATE_LOCALES,
  PRODUCT_UPDATE_TITLE_MAX,
  PUBLISHING_ACTIONS,
  availableActions,
  completeProductUpdate,
  deleteProductUpdate,
  getProductUpdate,
  missingLocalesOf,
  previewStatus,
  readProductUpdateError,
  removeProductUpdateImage,
  runProductUpdateAction,
  textsChanged,
  textsOf,
  updateProductUpdateTexts,
  uploadProductUpdateImage,
  type ProductUpdateAction,
  type ProductUpdateLocale,
  type ProductUpdateTexts,
  type ProductUpdateView,
} from '@/lib/portal-product-updates'
import {
  PRODUCT_UPDATE_SITUATION,
  STATUS_NAMESPACE,
  statusMeta,
} from '@/lib/portal-status'
import { cn } from '@/lib/utils'
import ptNovidades from '@/messages/pt/thinkzap/novidades/page.json'
import enNovidades from '@/messages/en/thinkzap/novidades/page.json'
import esNovidades from '@/messages/es/thinkzap/novidades/page.json'
import { useProductUpdateErrorToast } from './admin-product-update-errors'
import { AdminProductUpdateTaskMessages } from './admin-product-update-task-messages'
import { AdminProductUpdateTaskSection } from './admin-product-update-task-section'
import { AdminEmptyState } from './ui/admin-empty-state'
import { AdminPageHeader } from './ui/admin-page-header'
import { AdminPanel } from './ui/admin-panel'
import { AdminStatusBadge } from './ui/admin-status-badge'

const NAMESPACE = 'admin/product-updates'

/**
 * Selos do card no idioma da pré-visualização — os textos que o cliente lê na aba do
 * ThinkZap, e não os do portal: o operador em pt vê o card em inglês como o cliente
 * em inglês o vê.
 */
const CARD_LABELS: Record<ProductUpdateLocale, ProductUpdateCardLabels> = {
  pt: ptNovidades.badge,
  en: enNovidades.badge,
  es: esNovidades.badge,
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'error' }
  | { kind: 'ready'; view: ProductUpdateView }

/** `/admin/novidades/[id]`: carrega a novidade e abre a edição. */
export function AdminProductUpdateEditPage({ id }: { id: string }) {
  const { t } = useTranslation(NAMESPACE)
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  const load = useCallback(
    async (isCancelled: () => boolean = () => false) => {
      try {
        const view = await getProductUpdate(id)
        if (!isCancelled()) setState({ kind: 'ready', view })
      } catch (error) {
        if (isCancelled()) return
        const { status } = readProductUpdateError(error)
        setState({ kind: status === 404 ? 'not-found' : 'error' })
      }
    },
    [id],
  )

  useEffect(() => {
    let cancelled = false
    void load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  if (state.kind === 'ready') {
    return <ProductUpdateEditor key={state.view.id} initial={state.view} />
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        breadcrumb={[
          { label: t('detail.breadcrumb'), href: '/admin/novidades' },
        ]}
        title={
          state.kind === 'loading' ? (
            <span aria-hidden className="block h-8 w-72 rounded-md bg-muted" />
          ) : state.kind === 'not-found' ? (
            t('detail.notFoundTitle')
          ) : (
            t('detail.errorTitle')
          )
        }
      />

      {state.kind === 'loading' && (
        <div
          aria-busy
          className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]"
        >
          <p className="sr-only">{t('loading')}</p>
          <div className="h-96 rounded-lg border border-border bg-card" />
          <div className="h-96 rounded-lg border border-border bg-card" />
        </div>
      )}

      {state.kind === 'not-found' && (
        <AdminEmptyState
          icon={SearchX}
          title={t('detail.notFoundTitle')}
          description={t('detail.notFoundDescription')}
          action={
            <Link
              href="/admin/novidades"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <ArrowLeft aria-hidden className="size-3.5" />
              {t('detail.backToList')}
            </Link>
          }
        />
      )}

      {state.kind === 'error' && (
        <AdminEmptyState
          icon={AlertTriangle}
          title={t('detail.errorTitle')}
          description={t('errorDescription')}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setState({ kind: 'loading' })
                void load()
              }}
            >
              <RotateCw aria-hidden className="size-3.5" />
              {t('retry')}
            </Button>
          }
        />
      )}
    </div>
  )
}

type BusyAction = ProductUpdateAction | 'image' | 'task'

function ProductUpdateEditor({ initial }: { initial: ProductUpdateView }) {
  const { t } = useTranslation(NAMESPACE)
  const { t: tStatus } = useTranslation(STATUS_NAMESPACE)
  const router = useRouter()
  const showError = useProductUpdateErrorToast()
  const [view, setView] = useState(initial)
  const [texts, setTexts] = useState<ProductUpdateTexts>(() =>
    textsOf(initial.content),
  )
  const [locale, setLocale] = useState<ProductUpdateLocale>('pt')
  const [busy, setBusy] = useState<BusyAction | null>(null)
  const [confirming, setConfirming] = useState<ProductUpdateAction | null>(null)

  const dirty = textsChanged(texts, textsOf(view.content))
  const missing = useMemo(() => missingLocalesOf(texts), [texts])
  const actions = availableActions(view)
  const situation = statusMeta(PRODUCT_UPDATE_SITUATION, view.situation)
  const title = view.content.pt.title.trim() || t('untitled')

  /** Sair com texto não salvo pede confirmação do navegador. */
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  /** Uma resposta do servidor: o formulário segue o que foi salvo só quando pedido. */
  const accept = (next: ProductUpdateView, resetTexts: boolean) => {
    setView(next)
    if (resetTexts) setTexts(textsOf(next.content))
  }

  const save = async (): Promise<ProductUpdateView | null> => {
    try {
      const saved = await updateProductUpdateTexts(view.id, texts)
      accept(saved, true)
      return saved
    } catch (error) {
      showError(error)
      return null
    }
  }

  const run = async (action: ProductUpdateAction) => {
    if (busy) return
    setBusy(action)
    try {
      if (action === 'save') {
        const saved = await save()
        if (saved) {
          toast.success(
            saved.situation === 'draft'
              ? t('result.save')
              : t('result.savePending'),
          )
        }
        return
      }

      // Publicar usa o texto salvo: o que está no formulário vai antes.
      if (dirty && PUBLISHING_ACTIONS.has(action)) {
        if (!(await save())) return
      }

      switch (action) {
        case 'delete':
          await deleteProductUpdate(view.id)
          toast.success(t('result.delete'))
          router.push('/admin/novidades')
          return
        case 'complete': {
          const result = await completeProductUpdate(view.id)
          accept(result.update, false)
          if (result.awaitingApproval) {
            toast.warning(t('result.completeAwaitingApproval'))
          } else {
            toast.success(t('result.complete'))
          }
          return
        }
        default: {
          const updated = await runProductUpdateAction(view.id, action)
          accept(updated, action === 'discard-changes')
          toast.success(t(`result.${action}`))
        }
      }
    } catch (error) {
      showError(error)
    } finally {
      setBusy(null)
    }
  }

  const request = (action: ProductUpdateAction) => {
    if (CONFIRMED_ACTIONS.has(action)) setConfirming(action)
    else void run(action)
  }

  const setText = (
    target: ProductUpdateLocale,
    field: 'title' | 'description',
    value: string,
  ) =>
    setTexts(previous => ({
      ...previous,
      [target]: { ...previous[target], [field]: value },
    }))

  const has = (action: ProductUpdateAction) => actions.includes(action)
  const primary: ProductUpdateAction | null = has('publish-available')
    ? 'publish-available'
    : has('publish')
      ? 'publish'
      : null
  const secondary = (['publish', 'complete', 'reopen'] as const).filter(
    action => has(action) && action !== primary,
  )
  const menu = (['unpublish', 'delete'] as const).filter(has)
  const locked = busy !== null

  return (
    <div className="space-y-6">
      <AdminPageHeader
        breadcrumb={[
          { label: t('detail.breadcrumb'), href: '/admin/novidades' },
        ]}
        title={<span className="break-words">{title}</span>}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <AdminStatusBadge tone={situation.tone}>
              {tStatus(situation.labelKey)}
            </AdminStatusBadge>
            {view.hasPendingChanges && (
              <AdminStatusBadge tone="warning">
                {t('pendingChanges')}
              </AdminStatusBadge>
            )}
            {dirty && (
              <span className="text-xs text-muted-foreground">
                {t('detail.unsaved')}
              </span>
            )}
          </span>
        }
        actions={
          <div
            role="group"
            aria-label={t('detail.actionsLabel')}
            className="flex flex-wrap gap-2"
          >
            {secondary.map(action => (
              <Button
                key={action}
                variant="outline"
                disabled={locked}
                onClick={() => request(action)}
              >
                <ActionIcon action={action} busy={busy === action} />
                {t(`actions.${action}`)}
              </Button>
            ))}
            {primary && (
              <Button disabled={locked} onClick={() => request(primary)}>
                <ActionIcon action={primary} busy={busy === primary} />
                {t(`actions.${primary}`)}
              </Button>
            )}
            {menu.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={t('detail.moreActions')}
                  disabled={locked}
                  className={buttonVariants({
                    variant: 'outline',
                    size: 'icon',
                  })}
                >
                  <MoreHorizontal aria-hidden className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {menu.map(action => (
                    <DropdownMenuItem
                      key={action}
                      variant={action === 'delete' ? 'destructive' : 'default'}
                      onClick={() => request(action)}
                    >
                      <ActionIcon action={action} busy={false} />
                      {t(`actions.${action}`)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        }
      />

      {view.hasPendingChanges && (
        <section
          aria-label={t('detail.pendingBannerTitle')}
          className="flex flex-col gap-3 rounded-lg bg-status-warning-soft px-4 py-3 text-status-warning-ink sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {t('detail.pendingBannerTitle')}
            </p>
            <p className="text-sm">{t('detail.pendingBannerDescription')}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {has('discard-changes') && (
              <Button
                variant="outline"
                size="sm"
                disabled={locked}
                onClick={() => request('discard-changes')}
              >
                <ActionIcon
                  action="discard-changes"
                  busy={busy === 'discard-changes'}
                />
                {t('actions.discard-changes')}
              </Button>
            )}
            <Button
              size="sm"
              disabled={locked}
              onClick={() => request('publish-changes')}
            >
              <ActionIcon
                action="publish-changes"
                busy={busy === 'publish-changes'}
              />
              {t('actions.publish-changes')}
            </Button>
          </div>
        </section>
      )}

      {view.situation === 'awaiting-review' && (
        <p
          role="note"
          className="flex items-start gap-2 rounded-md bg-status-info-soft px-3 py-2 text-sm text-status-info-ink"
        >
          <ClipboardCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t('detail.awaitingReviewNotice')}
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="space-y-6">
          <AdminPanel title={t('content.title')}>
            <form
              onSubmit={event => {
                event.preventDefault()
                void run('save')
              }}
            >
              <Tabs
                value={locale}
                onValueChange={value => setLocale(value as ProductUpdateLocale)}
              >
                <div className="-mx-1 overflow-x-auto px-1">
                  <TabsList
                    variant="line"
                    aria-label={t('content.tabsLabel')}
                    className="border-b border-border"
                  >
                    {PRODUCT_UPDATE_LOCALES.map(code => (
                      <TabsTrigger
                        key={code}
                        value={code}
                        className="flex-none"
                      >
                        {t(`locales.${code}`)}
                        {missing.includes(code) && (
                          <span className="inline-flex items-center gap-1 text-xs font-normal text-status-warning-ink">
                            <span
                              aria-hidden
                              className="size-1.5 rounded-full bg-status-warning"
                            />
                            {t('content.incomplete')}
                          </span>
                        )}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>

                {PRODUCT_UPDATE_LOCALES.map(code => (
                  <TabsContent key={code} value={code} className="mt-4">
                    <LocaleFields
                      locale={code}
                      value={texts[code]}
                      onChange={(field, value) => setText(code, field, value)}
                    />
                  </TabsContent>
                ))}
              </Tabs>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  {missing.length > 0 ? t('content.incompleteHint') : null}
                </p>
                <Button type="submit" disabled={locked || !dirty}>
                  <ActionIcon action="save" busy={busy === 'save'} />
                  {busy === 'save' ? t('actions.saving') : t('actions.save')}
                </Button>
              </div>
            </form>
          </AdminPanel>

          <ImagePanel
            view={view}
            disabled={locked}
            onBusyChange={value => setBusy(value ? 'image' : null)}
            onChange={next => accept(next, false)}
          />
        </div>

        <div className="space-y-6">
          <AdminPanel title={t('preview.title')}>
            <p className="mb-4 text-sm text-muted-foreground">
              {t('preview.description', { locale: t(`locales.${locale}`) })}
            </p>
            <ProductUpdateCard
              headingAs="h3"
              locale={locale}
              labels={CARD_LABELS[locale]}
              update={{
                title:
                  texts[locale].title.trim() ||
                  t('preview.emptyTitle', { locale: t(`locales.${locale}`) }),
                description:
                  texts[locale].description.trim() ||
                  t('preview.emptyDescription', {
                    locale: t(`locales.${locale}`),
                  }),
                imageUrl: view.content.imageUrl,
                status: previewStatus(view),
                availableAt: view.availableAt,
              }}
            />
          </AdminPanel>

          <AdminProductUpdateTaskSection
            view={view}
            disabled={locked && busy !== 'task'}
            onBusyChange={value => setBusy(value ? 'task' : null)}
            onChange={next => accept(next, false)}
          />

          <DatesPanel view={view} />
        </div>
      </div>

      {view.task && (
        <AdminProductUpdateTaskMessages
          productUpdateId={view.id}
          taskId={view.task.id}
          disabled={locked}
        />
      )}

      <ConfirmActionDialog
        action={confirming}
        title={title}
        onClose={() => setConfirming(null)}
        onConfirm={action => {
          setConfirming(null)
          void run(action)
        }}
      />
    </div>
  )
}

function LocaleFields({
  locale,
  value,
  onChange,
}: {
  locale: ProductUpdateLocale
  value: { title: string; description: string }
  onChange: (field: 'title' | 'description', value: string) => void
}) {
  const { t, i18n } = useTranslation(NAMESPACE)
  const titleId = `product-update-title-${locale}`
  const descriptionId = `product-update-description-${locale}`
  const count = (used: number, max: number) =>
    t('content.characters', {
      used: used.toLocaleString(i18n.language),
      max: max.toLocaleString(i18n.language),
    })

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor={titleId}>{t('content.titleLabel')}</FieldLabel>
        <Input
          id={titleId}
          name={`title-${locale}`}
          lang={locale}
          autoComplete="off"
          maxLength={PRODUCT_UPDATE_TITLE_MAX}
          value={value.title}
          onChange={event => onChange('title', event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <FieldLabel htmlFor={descriptionId}>
            {t('content.descriptionLabel')}
          </FieldLabel>
          <span className="text-xs text-muted-foreground tabular-nums">
            {count(value.description.length, PRODUCT_UPDATE_DESCRIPTION_MAX)}
          </span>
        </div>
        <textarea
          id={descriptionId}
          name={`description-${locale}`}
          lang={locale}
          rows={8}
          maxLength={PRODUCT_UPDATE_DESCRIPTION_MAX}
          aria-describedby={`${descriptionId}-hint`}
          value={value.description}
          onChange={event => onChange('description', event.target.value)}
          className="min-h-40 w-full min-w-0 resize-y rounded-md border border-input bg-transparent px-2.5 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
        />
        <p
          id={`${descriptionId}-hint`}
          className="text-xs text-muted-foreground"
        >
          {t('content.descriptionHint')}
        </p>
      </div>
    </div>
  )
}

function ImagePanel({
  view,
  disabled,
  onBusyChange,
  onChange,
}: {
  view: ProductUpdateView
  disabled: boolean
  onBusyChange: (busy: boolean) => void
  onChange: (view: ProductUpdateView) => void
}) {
  const { t } = useTranslation(NAMESPACE)
  const showError = useProductUpdateErrorToast()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null)
  const imageUrl = view.content.imageUrl
  const hasImage = Boolean(view.content.imageKey)

  const run = async (
    kind: 'upload' | 'remove',
    action: () => Promise<ProductUpdateView>,
  ) => {
    setBusy(kind)
    onBusyChange(true)
    try {
      onChange(await action())
      toast.success(
        t(kind === 'upload' ? 'result.imageUploaded' : 'result.imageRemoved'),
      )
    } catch (error) {
      showError(error)
    } finally {
      setBusy(null)
      onBusyChange(false)
    }
  }

  const locked = disabled || busy !== null

  return (
    <AdminPanel title={t('image.title')}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="w-full shrink-0 sm:w-56">
          {imageUrl ? (
            // `<img>`: a URL vem do storage, sem domínio configurado no next/image.
            <img
              src={imageUrl}
              alt={t('image.alt')}
              width={1280}
              height={720}
              className="aspect-video h-auto w-full rounded-md border border-border bg-muted object-cover"
            />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center gap-2 rounded-md border border-dashed border-border text-sm text-muted-foreground">
              <ImageOff aria-hidden className="size-4" />
              {t('image.none')}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <p
            id="product-update-image-hint"
            className="text-sm text-muted-foreground"
          >
            {t('image.hint')}
          </p>
          <input
            ref={input}
            type="file"
            accept={PRODUCT_UPDATE_IMAGE_TYPES.join(',')}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={event => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file)
                void run('upload', () =>
                  uploadProductUpdateImage(view.id, file),
                )
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={locked}
              aria-describedby="product-update-image-hint"
              onClick={() => input.current?.click()}
            >
              {busy === 'upload' ? (
                <Loader2
                  aria-hidden
                  className="size-3.5 motion-safe:animate-spin"
                />
              ) : (
                <ImageUp aria-hidden className="size-3.5" />
              )}
              {busy === 'upload'
                ? t('image.uploading')
                : hasImage
                  ? t('image.replace')
                  : t('image.upload')}
            </Button>
            {hasImage && (
              <Button
                variant="ghost"
                size="sm"
                disabled={locked}
                onClick={() =>
                  void run('remove', () => removeProductUpdateImage(view.id))
                }
              >
                {busy === 'remove' ? (
                  <Loader2
                    aria-hidden
                    className="size-3.5 motion-safe:animate-spin"
                  />
                ) : (
                  <Trash2 aria-hidden className="size-3.5" />
                )}
                {t('image.remove')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </AdminPanel>
  )
}

function DatesPanel({ view }: { view: ProductUpdateView }) {
  const { t, i18n } = useTranslation(NAMESPACE)
  const rows: Array<[string, string | null]> = [
    ['createdAt', view.createdAt],
    ['publishedAt', view.publishedAt],
    ['doneAt', view.doneAt],
    ['availableAt', view.availableAt],
  ]

  return (
    <AdminPanel title={t('detail.facts.label')}>
      <dl className="divide-y divide-border text-sm">
        {rows.map(([key, value]) => (
          <div
            key={key}
            className="flex items-baseline justify-between gap-4 py-2 first:pt-0 last:pb-0"
          >
            <dt className="text-muted-foreground">
              {t(`detail.facts.${key}`)}
            </dt>
            <dd className="text-right text-foreground tabular-nums">
              {value
                ? formatPortalDate(value, i18n.language)
                : t('detail.facts.never')}
            </dd>
          </div>
        ))}
      </dl>
    </AdminPanel>
  )
}

function ActionIcon({
  action,
  busy,
}: {
  action: ProductUpdateAction
  busy: boolean
}) {
  const className = 'size-4'
  if (busy)
    return (
      <Loader2
        aria-hidden
        className={cn(className, 'motion-safe:animate-spin')}
      />
    )
  switch (action) {
    case 'save':
      return <Save aria-hidden className={className} />
    case 'publish':
    case 'publish-changes':
      return <Send aria-hidden className={className} />
    case 'publish-available':
      return <CircleCheck aria-hidden className={className} />
    case 'complete':
      return <ClipboardCheck aria-hidden className={className} />
    case 'reopen':
      return <CircleDashed aria-hidden className={className} />
    case 'discard-changes':
      return <Undo2 aria-hidden className={className} />
    case 'unpublish':
      return <EyeOff aria-hidden className={className} />
    case 'delete':
      return <Trash2 aria-hidden className={className} />
  }
}

/** Confirmação das ações que mudam o que o cliente vê, do descarte e da exclusão. */
function ConfirmActionDialog({
  action,
  title,
  onClose,
  onConfirm,
}: {
  action: ProductUpdateAction | null
  title: string
  onClose: () => void
  onConfirm: (action: ProductUpdateAction) => void
}) {
  const { t } = useTranslation(NAMESPACE)
  /** O texto fica durante a animação de saída, quando `action` já é `null`. */
  const [shown, setShown] = useState<ProductUpdateAction | null>(action)
  if (action && action !== shown) setShown(action)

  const destructive =
    shown === 'delete' || shown === 'unpublish' || shown === 'discard-changes'

  return (
    <Dialog
      open={action !== null}
      onOpenChange={open => {
        if (!open) onClose()
      }}
    >
      <DialogContent>
        {shown && (
          <>
            <DialogHeader>
              <DialogTitle>
                {t(`confirm.${shown}.title`, { title })}
              </DialogTitle>
              <DialogDescription>
                {t(`confirm.${shown}.description`)}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                {t('confirm.cancel')}
              </Button>
              <Button
                variant={destructive ? 'destructive' : 'default'}
                onClick={() => onConfirm(shown)}
              >
                {t(`confirm.${shown}.confirm`)}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
