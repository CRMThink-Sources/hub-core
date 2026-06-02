export type GoogleOAuthStatePayload = {
  appId: string
  domainId: string
}

type StateEntry = { payload: GoogleOAuthStatePayload; expiresAt: number }

export class GoogleOAuthStateStore {
  private readonly store = new Map<string, StateEntry>()
  private readonly ttlMs = 10 * 60 * 1000

  set(state: string, payload: GoogleOAuthStatePayload): void {
    this.sweepExpired()
    this.store.set(state, { payload, expiresAt: Date.now() + this.ttlMs })
  }

  private sweepExpired(): void {
    const now = Date.now()
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) this.store.delete(key)
    }
  }

  consume(state: string): GoogleOAuthStatePayload | null {
    const entry = this.store.get(state)
    this.store.delete(state)
    if (!entry || Date.now() > entry.expiresAt) return null
    return entry.payload
  }
}

export const googleOAuthStateStore = new GoogleOAuthStateStore()
