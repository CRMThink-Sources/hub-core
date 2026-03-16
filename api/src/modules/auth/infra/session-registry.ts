export interface SessionHanderPerformer {
  perform<T>(params: any): Promise<{ key: string; data: T }>
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
