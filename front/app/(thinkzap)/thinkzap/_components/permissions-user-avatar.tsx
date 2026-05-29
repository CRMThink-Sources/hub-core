'use client'

function initials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
  }
  const digits = label.replace(/\D/g, '')
  if (digits.length >= 2) return digits.slice(-2)
  return (label[0] ?? '?').toUpperCase()
}

type Props = {
  label: string
  size?: 'sm' | 'md'
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
}

export function PermissionsUserAvatar({ label, size = 'md' }: Props) {
  return (
    <div
      className={`${sizeClasses[size]} flex shrink-0 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700`}
    >
      {initials(label)}
    </div>
  )
}
