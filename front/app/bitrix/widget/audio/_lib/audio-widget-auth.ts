import type { BX24Auth } from '@/bitrix/types'

export function resolveDialogId(
  searchParams: URLSearchParams,
  urlParams: Record<string, string>,
): string | null {
  const fromQuery = searchParams.get('DIALOG_ID')
  if (fromQuery) return fromQuery

  const placementOptions = urlParams.PLACEMENT_OPTIONS
  if (!placementOptions) return null

  try {
    const parsed = JSON.parse(placementOptions) as { dialogId?: string }
    return parsed.dialogId ?? null
  } catch {
    return null
  }
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
