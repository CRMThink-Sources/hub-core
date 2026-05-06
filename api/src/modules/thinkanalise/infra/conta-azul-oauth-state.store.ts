type NewSourcePayload = {
  appId: string
  domainId: string
  connectorId: number
  title: string
  sourceId?: never
}
type ReconnectPayload = {
  appId: string
  domainId: string
  sourceId: number
  connectorId?: never
  title?: never
}
export type StatePayload = NewSourcePayload | ReconnectPayload

type StateEntry = { payload: StatePayload; expiresAt: number }

export class ContaAzulOAuthStateStore {
  private readonly store = new Map<string, StateEntry>()
  private readonly ttlMs = 10 * 60 * 1000

  set(state: string, payload: StatePayload): void {
    this.store.set(state, { payload, expiresAt: Date.now() + this.ttlMs })
  }

  consume(state: string): StatePayload | null {
    const entry = this.store.get(state)
    this.store.delete(state)
    if (!entry || Date.now() > entry.expiresAt) return null
    return entry.payload
  }
}

export const contaAzulOAuthStateStore = new ContaAzulOAuthStateStore()
