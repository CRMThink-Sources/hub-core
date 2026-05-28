export function formatPortalDate(iso: string, locale?: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }

  return new Intl.DateTimeFormat(locale ?? 'pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}
