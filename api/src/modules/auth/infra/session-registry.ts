/**
 * Contexto de autenticação da request, repassado a todos os handlers.
 *
 * O controller de sessão não interpreta nenhum destes campos — quem sabe o que
 * fazer com `bitrixUserId` / `bitrixDepartmentIds` é o módulo da app. Antes, a
 * fábrica do controller calculava o acesso do thinkzap num `if` por `appCode`,
 * o que colocava regra de um app no caminho de todos.
 */
export type SessionAuthContext = {
  /** Id da instalação em `core_apps`. */
  appId: string
  /** `appCodeId` do JWT — chave de `core_app_codes`. */
  appCodeId: string
  domainId: string
  bitrixUserId: string
  isBitrixAdmin: boolean
  bitrixDepartmentIds: string[]
}

export interface SessionHanderPerformer {
  perform<T>(params: SessionAuthContext): Promise<{ key: string; data: T }>
}

export interface SessionHandler {
  appCode: string
  handlers: SessionHanderPerformer[]
}

export class SessionRegistry {
  private handlers = new Map<string, SessionHandler>()

  register(handler: SessionHandler): void {
    this.handlers.set(handler.appCode, handler)
  }

  get(appCode: string): SessionHandler | undefined {
    return this.handlers.get(appCode)
  }
}
