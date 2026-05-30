import type { BX24PlacementInfo } from '@/bitrix/types'

export type ImbotAuth = {
  userId: string
  userHash: string
  domainHash: string
}

export function parseBitrixDomain(value: string): string {
  return value.replace(/^https?:\/\//, '').split('/')[0] ?? ''
}

export function parsePlacementOptions(
  raw: string | undefined,
): Record<string, string> {
  if (!raw) return {}

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const normalized: Record<string, string> = {}

    for (const [key, value] of Object.entries(parsed)) {
      if (value == null) continue
      if (typeof value === 'string') {
        normalized[key] = value
        continue
      }
      if (typeof value === 'number' || typeof value === 'boolean') {
        normalized[key] = String(value)
      }
    }

    return normalized
  } catch {
    return {}
  }
}

export function resolveImbotAuth(
  urlParams: Record<string, string>,
): ImbotAuth | null {
  const userId = urlParams.USER_ID
  const userHash = urlParams.USER_HASH
  const domainHash = urlParams.DOMAIN_HASH

  if (!userId || !userHash || !domainHash) return null

  return { userId, userHash, domainHash }
}

export function resolveDialogIdFromPlacementOptions(
  options: Record<string, string>,
): string | null {
  return options.dialogId ?? options.DIALOG_ID ?? options.dialog_id ?? null
}

export function resolveDialogId(
  searchParams: URLSearchParams,
  urlParams: Record<string, string>,
  placementOptions?: Record<string, string>,
  bx24Placement?: BX24PlacementInfo | null,
): string | null {
  const fromQuery = searchParams.get('DIALOG_ID')
  if (fromQuery) return fromQuery

  if (urlParams.DIALOG_ID) return urlParams.DIALOG_ID

  const fromUrlPlacement = resolveDialogIdFromPlacementOptions(
    parsePlacementOptions(urlParams.PLACEMENT_OPTIONS),
  )
  if (fromUrlPlacement) return fromUrlPlacement

  if (placementOptions) {
    const fromOptions = resolveDialogIdFromPlacementOptions(placementOptions)
    if (fromOptions) return fromOptions
  }

  if (bx24Placement?.options) {
    return resolveDialogIdFromPlacementOptions(bx24Placement.options)
  }

  return null
}

export function resolveBitrixDomain(
  searchParams: URLSearchParams,
  urlDomain: string | null | undefined,
  authDomain?: string | null,
): string | null {
  const raw = searchParams.get('DOMAIN') ?? urlDomain ?? authDomain ?? null
  return raw ? parseBitrixDomain(raw) : null
}

export function buildThinkzapAuthorizeUrl(
  domain: string,
  appCode: string,
): string {
  const normalized = parseBitrixDomain(domain)
  const code = appCode || 'crmthink.thinkzap'
  return `https://${normalized}/marketplace/app/${code}/`
}

export function hasUploadAuth(
  imbotAuth: ImbotAuth | null,
  accessToken: string | null,
): boolean {
  return Boolean(imbotAuth) || Boolean(accessToken)
}
