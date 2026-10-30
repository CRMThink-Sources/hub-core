import { CircleCheck, Clock } from 'lucide-react'

import { cn } from '@/lib/utils'

export type ProductUpdateStatus = 'available' | 'soon'

/** O que o card mostra de uma novidade — o item do cliente ou o rascunho do admin. */
export type ProductUpdateCardData = {
  title: string
  description: string
  imageUrl: string | null
  status: ProductUpdateStatus
  /** ISO; só lido em `available`. Em `soon` nunca aparece data, mesmo se vier. */
  availableAt?: string | null
}

export type ProductUpdateCardLabels = {
  /** Selo de `available` ("Disponível"). */
  available: string
  /** Selo de `soon` ("Em breve"). */
  soon: string
}

type Props = {
  update: ProductUpdateCardData
  labels: ProductUpdateCardLabels
  /** Idioma da data (`pt`, `en`, `es` ou BCP 47); desconhecido cai em `pt-BR`. */
  locale: string
  /** Nível do título; `h2` na aba do ThinkZap, `h3` dentro de outra seção. */
  headingAs?: 'h2' | 'h3'
  /** `eager` para o primeiro card da tela, que já aparece sem rolar. */
  imageLoading?: 'lazy' | 'eager'
  className?: string
}

const DATE_LOCALES: Record<string, string> = {
  pt: 'pt-BR',
  en: 'en-US',
  es: 'es-ES',
}

/**
 * Data de disponibilidade no idioma pedido. `availableAt` é um instante (quando a
 * tarefa foi concluída), então o dia sai no fuso de quem olha. Data inválida
 * volta `null` para o card esconder a data em vez de quebrar.
 */
export function formatProductUpdateDate(
  iso: string,
  locale: string,
): string | null {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const base = locale.split('-')[0]
  const intlLocale = locale.includes('-')
    ? locale
    : (DATE_LOCALES[base] ?? DATE_LOCALES.pt)
  return new Intl.DateTimeFormat(intlLocale, { dateStyle: 'long' }).format(date)
}

/**
 * Card de uma novidade: selo, título, descrição (quebras de linha preservadas) e
 * imagem opcional. Só apresentação — textos do selo e idioma vêm por props, para
 * a pré-visualização do admin renderizar qualquer idioma sem trocar o do app.
 */
export function ProductUpdateCard({
  update,
  labels,
  locale,
  headingAs: Heading = 'h2',
  imageLoading = 'lazy',
  className,
}: Props) {
  const isAvailable = update.status === 'available'
  const date =
    isAvailable && update.availableAt
      ? formatProductUpdateDate(update.availableAt, locale)
      : null

  return (
    <article
      className={cn(
        'overflow-hidden rounded-xl border border-border bg-card text-card-foreground',
        className,
      )}
    >
      {update.imageUrl && (
        // `<img>` e não `next/image`: a URL vem do storage, sem domínio configurado.
        <img
          src={update.imageUrl}
          alt=""
          loading={imageLoading}
          decoding="async"
          width={1280}
          height={720}
          className="aspect-video h-auto w-full border-b border-border bg-muted object-cover"
        />
      )}

      <div className="flex flex-col gap-3 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {isAvailable ? (
            <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-accent px-2.5 text-xs font-medium text-accent-foreground">
              <CircleCheck aria-hidden className="size-3.5" />
              {labels.available}
            </span>
          ) : (
            <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-muted px-2.5 text-xs font-medium text-foreground">
              <Clock aria-hidden className="size-3.5" />
              {labels.soon}
            </span>
          )}
          {date && update.availableAt && (
            <time
              dateTime={update.availableAt}
              className="text-xs text-muted-foreground tabular-nums"
            >
              {date}
            </time>
          )}
        </div>

        <Heading className="text-lg font-semibold leading-snug tracking-tight text-foreground text-pretty break-words">
          {update.title}
        </Heading>

        <p className="max-w-prose whitespace-pre-line break-words text-sm leading-relaxed text-foreground/85">
          {update.description}
        </p>
      </div>
    </article>
  )
}
