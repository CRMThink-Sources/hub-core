'use client'

import { useState } from 'react'

type Props = {
  src?: string | null
  label: string
  size?: 'sm' | 'md' | 'lg'
}

function initials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
  }
  const digits = label.replace(/\D/g, '')
  if (digits.length >= 2) return digits.slice(-2)
  return (label[0] ?? '?').toUpperCase()
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
        alt={label}
        onError={() => setFailed(true)}
        className={`${sizeClasses[size]} shrink-0 rounded-full object-cover bg-gray-100`}
      />
    )
  }

  return (
    <div
      className={`${sizeClasses[size]} flex shrink-0 items-center justify-center rounded-full bg-[#d9fce6] font-medium text-[#144A1B]`}
    >
      {initials(label)}
    </div>
  )
}
