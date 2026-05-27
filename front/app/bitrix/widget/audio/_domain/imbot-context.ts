export type ImbotAuth = {
  userId: string
  userHash: string
  domainHash: string
}

export function parseBitrixDomain(value: string): string {
  return value.replace(/^https?:\/\//, '').split('/')[0] ?? ''
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

export function resolveDialogId(
  searchParams: URLSearchParams,
  urlParams: Record<string, string>,
): string | null {
  const fromQuery = searchParams.get('DIALOG_ID')
  if (fromQuery) return fromQuery

  if (urlParams.DIALOG_ID) return urlParams.DIALOG_ID

  return null
}

export function resolveBitrixDomain(
  searchParams: URLSearchParams,
  urlDomain: string | null | undefined,
): string | null {
  const raw = searchParams.get('DOMAIN') ?? urlDomain ?? null
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
