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

/** Resultado típico de BX24.callMethod (objeto com error e data) */
export interface BX24CallMethodResult {
  error?: () => string | boolean
  data?: () => unknown
}

/** Informações de contexto do placement retornadas por BX24.placement.info() */
export interface BX24PlacementInfo {
  /** Código do placement (ex.: "CONTACT_CENTER", "CRM_DEAL_DETAIL_TAB") */
  placement: string
  /** Opções do contexto (ex.: { LINE_ID: "105" } para CONTACT_CENTER) */
  options: Record<string, string>
}

export interface BX24Api {
  init: (callback: () => void) => void
  installFinish: () => void
  getAuth?: () => BX24Auth | false
  /** Indica se o usuário atual é administrador do portal Bitrix24. */
  isAdmin?: () => boolean
  /** Chama um método REST. Assinatura comum: callMethod(method, params, callback). */
  callMethod?: (
    method: string,
    params?: Record<string, unknown>,
    callback?: (result: BX24CallMethodResult) => void,
  ) => void
  /** Ajusta o frame à altura do conteúdo. O callback é opcional. */
  fitWindow?: (callback?: () => void) => void
  resizeWindow?: (width: number, height: number) => void
  /** Métodos de interação com o placement (widget) */
  placement?: {
    /** Retorna informações de contexto do placement atual */
    info: () => BX24PlacementInfo
    /** Obtém a interface JS disponível (commands e events) */
    getInterface: (
      callback: (result: { command: string[]; event: string[] }) => void,
    ) => void
    /** Invoca um comando registrado da interface do placement */
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

/** Estado do fluxo de instalação do app no Bitrix24 */
export type InstallStatus = 'idle' | 'loading' | 'success' | 'error'

/** Estado retornado pelo hook useBX24 */
export interface BX24State {
  /** Script do BX24 foi carregado */
  scriptLoaded: boolean
  /** BX24.init() foi executado com sucesso (app dentro do iframe Bitrix24) */
  ready: boolean
  /** Mensagem de erro quando ready === false após timeout */
  error: string | null
}

/**
 * Informações do app retornadas por BX24.callMethod("app.info").
 * Pode conter outros campos conforme a documentação Bitrix24.
 */
export interface BitrixAppInfoResult {
  /** Código do aplicativo */
  CODE?: string
  /** ID do aplicativo */
  ID?: string
  [key: string]: unknown
}

/**
 * Informações do app para o payload de instalação.
 * appInfoData vem de callMethod("app.info"); domain/member_id podem vir do auth ou URL.
 */
export interface BitrixAppInfo {
  /** Domínio do portal (ex.: "empresa.bitrix24.com.br") */
  domain?: string
  /** ID do membro/portal */
  member_id?: string
  /** Dados retornados por BX24.callMethod("app.info") */
  appInfoData?: BitrixAppInfoResult
  /** Parâmetros da URL do iframe (opcional) */
  urlParams?: Record<string, string>
}

/**
 * Payload completo para enviar à sua API antes de concluir a instalação.
 * Junta auth (BX24.getAuth), appInfo (URL/contexto) e dados do formulário (ex.: email).
 */
export interface BitrixInstallPayload {
  domain: string
  member_id: string
  app_code: string
  email: string
  access_token: string
  refresh_token: string
  expires_in: number
}
