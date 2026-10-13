/**
 * Exclusão mútua das rodadas da varredura de expiração — a agendada de cada
 * instância e a manual do backoffice disputam o mesmo lock, e só uma varre.
 *
 * `tryAcquire` devolve o token do dono, ou `null` se outra rodada está com ele.
 * `release` só solta se o token ainda for o do dono: um lock que expirou e foi
 * pego por outra rodada não pode ser solto por quem o perdeu.
 */
export interface SubscriptionExpirationLock {
  tryAcquire(): Promise<string | null>
  release(token: string): Promise<void>
}
