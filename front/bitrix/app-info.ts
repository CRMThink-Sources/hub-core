import type { BX24Auth } from './types'
import type {
  BitrixAppInfo,
  BitrixAppInfoResult,
  BitrixInstallPayload,
} from './types'

/** Nomes de parâmetros que o Bitrix24 costuma passar na URL do iframe do app */
const KNOWN_URL_PARAMS = [
  'DOMAIN',
  'member_id',
  'AUTH_ID',
  'REFRESH_ID',
  'PLACEMENT',
  'PLACEMENT_OPTIONS',
  'USER_ID',
  'USER_HASH',
  'DOMAIN_HASH',
  'IFRAME',
] as const

/**
 * Lê os parâmetros da query string da URL atual (quando a página abre no iframe do Bitrix24).
 * Chamar apenas no cliente.
 */
export function getBitrixAppInfoFromUrl(): Partial<
  Pick<BitrixAppInfo, 'domain' | 'member_id' | 'urlParams'>
> {
  if (typeof window === 'undefined') {
    return {}
  }
  const search = window.location.search
  if (!search) return {}

  const params = new URLSearchParams(search)
  const urlParams: Record<string, string> = {}
  KNOWN_URL_PARAMS.forEach(key => {
    const value = params.get(key)
    if (value != null) urlParams[key] = value
  })
  params.forEach((value, key) => {
    if (!KNOWN_URL_PARAMS.some(k => k === key)) {
      urlParams[key] = value
    }
  })

  const domain = params.get('DOMAIN') ?? undefined
  const member_id = params.get('member_id') ?? undefined

  return {
    ...(domain && { domain }),
    ...(member_id && { member_id }),
    ...(Object.keys(urlParams).length > 0 && { urlParams }),
  }
}

/**
 * Obtém informações do app via BX24.callMethod("app.info").
 * Chamar apenas no cliente, com BX24 já inicializado.
 */
export function fetchAppInfoFromCallMethod(): Promise<BitrixAppInfoResult> {
  return new Promise((resolve, reject) => {
    const BX24 = typeof window !== 'undefined' ? window.BX24 : undefined
    if (!BX24?.callMethod) {
      reject(new Error('BX24.callMethod não disponível.'))
      return
    }
    BX24.callMethod(
      'app.info',
      {},
      (result: { error?: () => string | boolean; data?: () => unknown }) => {
        if (result?.error?.()) {
          const err =
            typeof result.error === 'function' ? result.error() : result.error
          reject(new Error(String(err)))
          return
        }
        const data = result?.data?.()
        resolve((data as BitrixAppInfoResult) ?? {})
      },
    )
  })
}

/**
 * Monta o payload para enviar à sua API antes de chamar installFinish.
 * Combina auth, appInfo (appInfoData de callMethod("app.info") + domain/member_id + urlParams) e email.
 */
export function buildInstallPayload(
  auth: BX24Auth,
  options: {
    appInfoData?: BitrixAppInfoResult
    appInfoOverride?: Partial<BitrixAppInfo>
    email?: string
  } = {},
): BitrixInstallPayload {
  return {
    access_token: auth.access_token,
    refresh_token: auth.refresh_token,
    domain: auth.domain,
    app_code: options.appInfoData?.CODE ?? '',
    email: options.email?.trim() ?? '',
    member_id: auth.member_id,
    expires_in: auth.expires_in,
  }
}
