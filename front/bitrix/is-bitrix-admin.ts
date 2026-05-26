export function isBitrixAdmin(): boolean {
  if (typeof window === 'undefined') return false
  return Boolean(window.BX24?.isAdmin?.())
}
