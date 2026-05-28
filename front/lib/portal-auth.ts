export const PORTAL_AUTH_TOKEN_KEY = 'hubthink_portal_token'

export function getPortalToken(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(PORTAL_AUTH_TOKEN_KEY)
}

export function setPortalToken(token: string): void {
  sessionStorage.setItem(PORTAL_AUTH_TOKEN_KEY, token)
}

export function clearPortalToken(): void {
  sessionStorage.removeItem(PORTAL_AUTH_TOKEN_KEY)
}
