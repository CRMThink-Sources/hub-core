import { AsyncLocalStorage } from 'node:async_hooks'

export type LogContext = {
  domain?: string
  appId?: string
  // Correlaciona todas as linhas de um mesmo fluxo (request HTTP ou job).
  traceKey?: string
}

const storage = new AsyncLocalStorage<LogContext>()

export function runWithLogContext<T>(ctx: LogContext, fn: () => T): T {
  return storage.run({ ...ctx }, fn)
}

export function getLogContext(): LogContext {
  return storage.getStore() ?? {}
}

// Enriquece o contexto do request/job atual. No-op se não houver store ativo.
export function setLogContext(patch: LogContext): void {
  const store = storage.getStore()
  if (store) Object.assign(store, patch)
}
