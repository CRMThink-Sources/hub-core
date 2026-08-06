'use client'

import { useState } from 'react'

type Props = {
  src?: string | null
  /**
   * Aceita ausente de propósito: o rótulo é derivado de campos de provider
   * (`subject`, `phone`, `name`) que o tipo promete como `string` mas a resposta
   * nem sempre traz. Tratar aqui evita que um campo vazio derrube o render.
   */
  label?: string | null
  size?: 'sm' | 'md' | 'lg'
}

function initials(label?: string | null): string {
  const text = (label ?? '').trim()
  if (!text) return '?'

  const parts = text.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
  }
  const digits = text.replace(/\D/g, '')
  if (digits.length >= 2) return digits.slice(-2)
  return (text[0] ?? '?').toUpperCase()
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-16 w-16 text-lg',
}

export function GrupoAvatar({ src, label, size = 'md' }: Props) {
  const [failed, setFailed] = useState(false)

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={label ?? ''}
        onError={() => setFailed(true)}
        className={`${sizeClasses[size]} shrink-0 rounded-full object-cover bg-muted`}
      />
    )
  }

  return (
    <div
      className={`${sizeClasses[size]} flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-medium text-primary`}
    >
      {initials(label)}
    </div>
  )
}
