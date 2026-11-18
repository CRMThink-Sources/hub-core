import { normalizeBitrixDomain } from '@/shared/infra/clients/normalize-bitrix-domain'

/**
 * Escopos exatos que a chave Vibecode do Insights precisa ter. Nem mais (a
 * chave é do cliente e não deve dar acesso além do necessário), nem menos
 * (o Insights quebraria ao consultar CRM, canais abertos, usuários e deptos).
 */
export const REQUIRED_VIBECODE_SCOPES = [
  'crm',
  'imopenlines',
  'im',
  'user',
  'department',
] as const

/** Resposta de `me` da API Vibecode para a chave informada. */
export type VibecodeMe = {
  type: string
  portal?: string
  portalId?: string
  scopes: string[]
  accessMode: string
}

export type KeyRejection = {
  code:
    | 'WRONG_TYPE'
    | 'WRONG_PORTAL'
    | 'MISSING_SCOPES'
    | 'EXTRA_SCOPES'
    | 'NOT_READONLY'
  scopes?: string[]
}

export type KeyVerdict = { ok: true } | { ok: false; reasons: KeyRejection[] }

/**
 * Avalia se a chave pode ser usada pelo Insights. Acumula todos os motivos de
 * recusa (em vez de parar no primeiro) para o cliente corrigir a chave de
 * uma vez só. Domínios são comparados normalizados e em minúsculas porque o
 * domínio instalado pode vir com protocolo, barra final ou caixa diferente.
 */
export function evaluateVibecodeMe(
  me: VibecodeMe,
  installedDomain: string,
): KeyVerdict {
  const reasons: KeyRejection[] = []

  if (me.type !== 'personal') reasons.push({ code: 'WRONG_TYPE' })

  const installed = normalizeBitrixDomain(installedDomain).toLowerCase()
  const portal = normalizeBitrixDomain(me.portal ?? '').toLowerCase()
  if (!portal || portal !== installed) reasons.push({ code: 'WRONG_PORTAL' })

  const required: readonly string[] = REQUIRED_VIBECODE_SCOPES
  const missing = required.filter(scope => !me.scopes.includes(scope))
  const extra = me.scopes.filter(scope => !required.includes(scope))
  if (missing.length > 0) {
    reasons.push({ code: 'MISSING_SCOPES', scopes: missing })
  }
  if (extra.length > 0) reasons.push({ code: 'EXTRA_SCOPES', scopes: extra })

  if (me.accessMode !== 'READONLY') reasons.push({ code: 'NOT_READONLY' })

  return reasons.length === 0 ? { ok: true } : { ok: false, reasons }
}
