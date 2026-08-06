import type { LineEntitlement } from './use-line-api'

/**
 * Reconhece a recusa por **linha bloqueada** entre as outras.
 *
 * A api responde `402` com `{ code: 'line-blocked', entitlement }`, e não `403`:
 * `403` desta api significa "você não pode fazer isso" — é o guard de permissão — e
 * linha bloqueada é outra coisa. O usuário pode; a instalação é que não tem mais
 * direito à linha. Confundir os dois manda o cliente falar com o administrador
 * quando o que ele precisa é contratar.
 *
 * A discriminação é pelo `code`, não pela mensagem: ela é interpolada com o id do
 * item, então comparar texto nunca casaria.
 *
 * `null` = qualquer outro erro, que segue o caminho normal de mensagem.
 */
export function extractLineBlocked(err: unknown): LineEntitlement | null {
  if (!err || typeof err !== 'object' || !('response' in err)) return null

  const response = (err as { response?: unknown }).response
  if (!response || typeof response !== 'object') return null

  const { status, data } = response as { status?: number; data?: unknown }
  if (status !== 402) return null

  if (!data || typeof data !== 'object' || !('result' in data)) return null

  const result = (data as { result?: unknown }).result
  if (!result || typeof result !== 'object') return null

  const { code, entitlement } = result as {
    code?: unknown
    entitlement?: unknown
  }

  if (code !== 'line-blocked') return null

  return entitlement === 'trial-expired' || entitlement === 'inactive'
    ? entitlement
    : /**
       * `402` com `code` certo e `entitlement` que a tela não conhece: ainda é
       * bloqueio, e degradar para `inactive` diz a coisa mais conservadora em vez
       * de cair no erro genérico.
       */
      'inactive'
}
