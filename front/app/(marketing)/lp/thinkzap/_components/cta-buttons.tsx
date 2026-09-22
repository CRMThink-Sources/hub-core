import { ArrowRight, MessageCircle } from 'lucide-react'
import type { ThinkzapCtas } from './resolve-ctas'

type Props = ThinkzapCtas & {
  /** `onPrimary` inverte as cores para usar sobre fundo `bg-primary`. */
  tone?: 'default' | 'onPrimary'
  className?: string
}

const EXTERNAL = { target: '_blank', rel: 'noopener noreferrer' } as const

/**
 * "Instalar no Bitrix24" (primário) e "Falar no WhatsApp" (secundário). Cada
 * botão só aparece com o destino configurado; sem nenhum, não renderiza nada.
 * Empilha no celular e fica lado a lado a partir de `sm`.
 */
export function CtaButtons({
  marketUrl,
  whatsappLink,
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
          Instalar no Bitrix24
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
          Falar no WhatsApp
        </a>
      )}
    </div>
  )
}
