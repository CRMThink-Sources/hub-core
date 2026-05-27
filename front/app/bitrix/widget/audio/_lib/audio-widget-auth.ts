import type { BX24Auth } from '@/bitrix/types'

export type ImbotIframeAuth = {
  userId: string
  userHash: string
  domainHash: string
}

export function parseBitrixDomain(value: string): string {
  return value.replace(/^https?:\/\//, '').split('/')[0] ?? ''
}

export function resolveDialogId(
  searchParams: URLSearchParams,
  urlParams: Record<string, string>,
): string | null {
  const fromQuery = searchParams.get('DIALOG_ID')
  if (fromQuery) return fromQuery

  if (urlParams.DIALOG_ID) return urlParams.DIALOG_ID

  const placementOptions = urlParams.PLACEMENT_OPTIONS
  if (!placementOptions) return null

  try {
    const parsed = JSON.parse(placementOptions) as { dialogId?: string }
    return parsed.dialogId ?? null
  } catch {
    return null
  }
}

export function resolveImbotIframeAuth(
  urlParams: Record<string, string>,
): ImbotIframeAuth | null {
  const userId = urlParams.USER_ID
  const userHash = urlParams.USER_HASH
  const domainHash = urlParams.DOMAIN_HASH

  if (!userId || !userHash || !domainHash) return null

  return { userId, userHash, domainHash }
}

export function isImbotIframeContext(
  urlParams: Record<string, string>,
): boolean {
  return resolveImbotIframeAuth(urlParams) !== null
}

export function resolveAccessToken(
  getAuth: (() => BX24Auth | false) | undefined,
  urlParams: Record<string, string>,
): string | null {
  const auth = getAuth?.()
  if (auth && typeof auth === 'object' && auth.access_token) {
    return auth.access_token
  }

  return urlParams.AUTH_ID ?? null
}
