/**
 * Reconhece a recusa por **linha desconectada** entre as outras.
 *
 * A api responde `409` com `{ code: 'line-disconnected' }`, e não `402`: `402` é
 * `line-blocked` — a instalação não tem mais direito à linha, e a saída é contratar
 * (ver `extract-line-blocked`). Desconexão é conflito de estado: o direito existe,
 * a linha é que não está conectada agora, e a saída é reconectar o telefone.
 *
 * A discriminação é pelo `code`, não pela mensagem: ela é interpolada com o id do
 * item, então comparar texto nunca casaria.
 *
 * `false` = qualquer outro erro, que segue o caminho normal de
 * `thinkzapApiErrorMessage`.
 */
export function isLineDisconnectedError(err: unknown): boolean {
  if (!err || typeof err !== 'object' || !('response' in err)) return false

  const response = (err as { response?: unknown }).response
  if (!response || typeof response !== 'object') return false

  const { status, data } = response as { status?: number; data?: unknown }
  if (status !== 409) return false

  if (!data || typeof data !== 'object' || !('result' in data)) return false

  const result = (data as { result?: unknown }).result
  if (!result || typeof result !== 'object') return false

  return (result as { code?: unknown }).code === 'line-disconnected'
}
