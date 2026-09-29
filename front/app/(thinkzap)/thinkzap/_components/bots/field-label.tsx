'use client'

import { HintTooltip } from './hint-tooltip'

export const fieldLabel =
  'text-[10px] font-semibold uppercase text-muted-foreground'

/** Rótulo de campo do editor: o mesmo tipo em todo painel, com a ajuda no balão. */
export function FieldLabel({
  children,
  hint,
  warning,
  side = 'bottom',
}: {
  children: React.ReactNode
  hint?: string
  /** Some quando a configuração passa a fazer sentido; o rótulo continua igual. */
  warning?: string | null
  side?: 'top' | 'bottom'
}) {
  return (
    <span className="flex items-center gap-1">
      <span className={fieldLabel}>{children}</span>
      {hint ? <HintTooltip text={hint} side={side} /> : null}
      {warning ? <HintTooltip text={warning} tone="warn" side={side} /> : null}
    </span>
  )
}
