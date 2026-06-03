'use client'

import Link from 'next/link'
import { TriangleAlertIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = {
  message: string
  ctaLabel: string
  href: string
}

export function ConexaoPendenteBanner({ message, ctaLabel, href }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 rounded-xl border border-border bg-muted/40 px-4 py-3 text-foreground"
    >
      <div className="flex items-center gap-2">
        <TriangleAlertIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="text-sm">{message}</span>
      </div>
      <Button
        variant="outline"
        size="sm"
        nativeButton={false}
        render={<Link href={href} />}
      >
        {ctaLabel}
      </Button>
    </div>
  )
}
