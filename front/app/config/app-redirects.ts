import { envConfig } from '@/shared/infra/env-config'

const DEFAULT_APP_REDIRECTS: Record<
  string,
  { baseRedirectUrl: string; storageAuthTokenKey: string }
> = {
  'crmthink.thinkzap': {
    baseRedirectUrl: '/thinkzap',
    storageAuthTokenKey: 'hubthink_auth_token',
  },
  [envConfig.appCodes.thinkzap]: {
    baseRedirectUrl: '/thinkzap',
    storageAuthTokenKey: 'hubthink_auth_token',
  },
  [envConfig.appCodes.thinkanalise]: {
    baseRedirectUrl: '/thinkanalise',
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
