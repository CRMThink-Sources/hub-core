/**
 * Tipos da API BX24 (Bitrix24) exposta no window quando a página roda no iframe do app.
 * @see https://apidocs.bitrix24.com/sdk/bx24-js-sdk/
 */

export interface BX24Auth {
  access_token: string
  domain: string
  expires_in: number
  member_id: string
  refresh_token: string
}

export interface BX24CallMethodResult {
  error?: () => string | boolean
  data?: () => unknown
}

export interface BX24PlacementInfo {
  /** Ex.: "CONTACT_CENTER", "CRM_DEAL_DETAIL_TAB" */
  placement: string
  /** Ex.: { LINE_ID: "105" } para CONTACT_CENTER */
  options: Record<string, string>
}

export interface BX24Api {
  init: (callback: () => void) => void
  installFinish: () => void
  getAuth?: () => BX24Auth | false
  /** Código do Bitrix, não ISO: "br", "en", "la" (espanhol). */
  getLang?: () => string
  isAdmin?: () => boolean
  callMethod?: (
    method: string,
    params?: Record<string, unknown>,
    callback?: (result: BX24CallMethodResult) => void,
  ) => void
  fitWindow?: (callback?: () => void) => void
  resizeWindow?: (width: number, height: number) => void
  placement?: {
    info: () => BX24PlacementInfo
    getInterface: (
      callback: (result: { command: string[]; event: string[] }) => void,
    ) => void
    call: (
      command: string,
      params?: Record<string, unknown>,
      callback?: (result: unknown) => void,
    ) => void
  }
}

declare global {
  interface Window {
    BX24?: BX24Api
  }
}

export type InstallStatus = 'idle' | 'loading' | 'success' | 'error'

export interface BX24State {
  scriptLoaded: boolean
  /** `BX24.init()` só completa dentro do iframe do Bitrix24. */
  ready: boolean
  /** Preenchido quando o init não completa dentro do timeout. */
  error: string | null
}

export interface BitrixAppInfoResult {
  CODE?: string
  ID?: string
  [key: string]: unknown
}

/** `domain`/`member_id` podem vir do auth ou dos parâmetros da URL. */
export interface BitrixAppInfo {
  domain?: string
  member_id?: string
  appInfoData?: BitrixAppInfoResult
  urlParams?: Record<string, string>
}

export interface BitrixInstallPayload {
  domain: string
  member_id: string
  app_code: string
  email: string
  access_token: string
  refresh_token: string
  expires_in: number
}
