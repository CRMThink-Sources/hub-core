import { envConfig } from '@/shared/infra/env-config'

const DEFAULT_APP_REDIRECTS: Record<
  string,
  { baseRedirectUrl: string; storageAuthTokenKey: string }
> = {
  [envConfig.appCodes.thinkzap]: {
    baseRedirectUrl: '/apps/thinkzap',
    storageAuthTokenKey: 'hubthink_auth_token',
  },
}

export function getAppRedirectUrl(
  appCode: string,
): { baseRedirectUrl: string; storageAuthTokenKey: string } | null {
  const { baseRedirectUrl, storageAuthTokenKey } =
    DEFAULT_APP_REDIRECTS[appCode] ?? {}
  if (!baseRedirectUrl || !storageAuthTokenKey) return null
  return { baseRedirectUrl, storageAuthTokenKey }
}
