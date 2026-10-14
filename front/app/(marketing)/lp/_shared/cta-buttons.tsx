import { ArrowRight, MessageCircle } from 'lucide-react'
import type { LpBaseContent } from './content'
import type { LpCtas } from './resolve-ctas'

type Props = LpCtas & {
  labels: LpBaseContent['ctaButtons']
  /** Para usar sobre fundo `bg-primary`. */
  tone?: 'default' | 'onPrimary'
  className?: string
}

const EXTERNAL = { target: '_blank', rel: 'noopener noreferrer' } as const

export function CtaButtons({
  marketUrl,
  whatsappLink,
  labels,
  tone = 'default',
  className = '',
}: Props) {
  if (!marketUrl && !whatsappLink) return null

  const primary =
    tone === 'onPrimary'
      ? 'bg-white text-primary hover:bg-white/90'
      : 'bg-primary text-primary-foreground hover:bg-primary/90'
  const secondary =
    tone === 'onPrimary'
      ? 'border-white/70 text-white hover:bg-white/10'
      : 'border-primary/40 text-primary hover:bg-accent'

  return (
    <div className={`flex flex-col gap-3 sm:flex-row ${className}`}>
      {marketUrl && (
        <a
          href={marketUrl}
          {...EXTERNAL}
          className={`inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold shadow-sm transition-colors ${primary}`}
        >
          {labels.install}
          <ArrowRight aria-hidden className="size-4" />
        </a>
      )}
      {whatsappLink && (
        <a
          href={whatsappLink}
          {...EXTERNAL}
          className={`inline-flex items-center justify-center gap-2 rounded-lg border px-6 py-3 text-sm font-semibold transition-colors ${secondary}`}
        >
          <MessageCircle aria-hidden className="size-4" />
          {labels.whatsapp}
        </a>
      )}
    </div>
  )
}
