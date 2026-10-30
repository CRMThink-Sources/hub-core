import { ChevronDown, CircleCheck, Clock } from 'lucide-react'

import {
  formatProductUpdateDate,
  type ProductUpdateCardData,
  type ProductUpdateCardLabels,
} from '@/components/product-updates/product-update-card'
import { cn } from '@/lib/utils'

type Props = {
  update: ProductUpdateCardData & { id: string }
  labels: ProductUpdateCardLabels
  /** Idioma da data (`pt`, `en`, `es` ou BCP 47). */
  locale: string
  open: boolean
  onToggle: () => void
}

/**
 * Uma novidade como linha recolhida: selo, título e data. Aberta, mostra a
 * descrição e a imagem dentro do próprio registro. A imagem só entra no DOM com a
 * linha aberta, para dezenas de itens não baixarem dezenas de imagens à toa.
 * O estado de aberto fica com a lista, que abre uma linha por vez.
 */
export function NovidadeRow({ update, labels, locale, open, onToggle }: Props) {
  const isAvailable = update.status === 'available'
  const date =
    isAvailable && update.availableAt
      ? formatProductUpdateDate(update.availableAt, locale)
      : null
  const panelId = `novidade-${update.id}`

  return (
    <article className="border-b border-border last:border-b-0">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 sm:px-5"
        >
          {isAvailable ? (
            <span className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-accent px-2.5 text-xs font-medium text-accent-foreground">
              <CircleCheck aria-hidden className="size-3.5" />
              {labels.available}
            </span>
          ) : (
            <span className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 text-xs font-medium text-foreground">
              <Clock aria-hidden className="size-3.5" />
              {labels.soon}
            </span>
          )}
          <span className="min-w-0 flex-1 text-sm font-semibold leading-snug text-foreground break-words sm:text-base">
            {update.title}
          </span>
          {date && update.availableAt && (
            <time
              dateTime={update.availableAt}
              className="hidden shrink-0 text-xs text-muted-foreground tabular-nums sm:block"
            >
              {date}
            </time>
          )}
          <ChevronDown
            aria-hidden
            className={cn(
              'size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none',
              open && 'rotate-180',
            )}
          />
        </button>
      </h2>

      {open && (
        <div
          id={panelId}
          role="region"
          aria-label={update.title}
          className="flex flex-col gap-4 px-4 pb-5 sm:px-5"
        >
          {date && update.availableAt && (
            <time
              dateTime={update.availableAt}
              className="text-xs text-muted-foreground tabular-nums sm:hidden"
            >
              {date}
            </time>
          )}
          <p className="max-w-prose whitespace-pre-line break-words text-sm leading-relaxed text-foreground/85">
            {update.description}
          </p>
          {update.imageUrl && (
            // `<img>` e não `next/image`: a URL vem do storage, sem domínio configurado.
            <img
              src={update.imageUrl}
              alt=""
              decoding="async"
              width={1280}
              height={720}
              className="aspect-video h-auto w-full rounded-lg border border-border bg-muted object-cover"
            />
          )}
        </div>
      )}
    </article>
  )
}
