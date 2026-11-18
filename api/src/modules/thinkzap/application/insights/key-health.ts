/**
 * Estado em memória do problema da chave Vibecode por instalação. Fica só no
 * processo: é um aviso transitório (ex.: a Vibecode recusou a chave em uma
 * consulta), não um dado a persistir. Ao regravar ou remover a chave ele é
 * limpo, e uma nova recusa o marca de novo.
 */
export type KeyProblem = 'revoked'

const problems = new Map<string, KeyProblem>()

export function markKeyRevoked(appId: string): void {
  problems.set(appId, 'revoked')
}

export function clearKeyProblem(appId: string): void {
  problems.delete(appId)
}

export function getKeyProblem(appId: string): KeyProblem | null {
  return problems.get(appId) ?? null
}
