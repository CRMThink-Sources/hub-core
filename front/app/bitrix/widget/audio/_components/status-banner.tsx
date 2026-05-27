type StatusBannerProps = {
  variant: 'success' | 'error'
  message: string
}

export function StatusBanner({ variant, message }: StatusBannerProps) {
  const styles =
    variant === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : 'border-rose-200 bg-rose-50 text-rose-700'

  return (
    <p
      className={`mt-3 rounded-lg border px-3 py-2 text-xs ${styles}`}
      role={variant === 'error' ? 'alert' : 'status'}
    >
      {message}
    </p>
  )
}
