/** Unix timestamp in seconds (roughly year 2001–2286). */
const UNIX_SECONDS_THRESHOLD = 1e9

/** Unix timestamp in milliseconds (roughly year 2001–2286). */
const UNIX_MS_THRESHOLD = 1e12

/**
 * BX24.getAuth() may send expires_in as OAuth TTL (seconds) or as an absolute
 * expiry timestamp (seconds or ms). Bitrix OAuth refresh typically uses TTL.
 */
export function resolveBitrixTokenExpiresAt(expiresIn: number): Date {
  if (expiresIn > UNIX_MS_THRESHOLD) {
    return new Date(expiresIn)
  }
  if (expiresIn > UNIX_SECONDS_THRESHOLD) {
    return new Date(expiresIn * 1000)
  }
  return new Date(Date.now() + expiresIn * 1000)
}
