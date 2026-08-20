/**
 * JWT da app em `sessionStorage`, isolado por aplicação.
 *
 * As quatro apps gravavam na mesma chave `hubthink_auth_token`. Abrir thinkzap e
 * thinkanalise no mesmo navegador fazia a segunda sobrescrever o token da
 * primeira, e a partir daí a primeira chamava a API com o JWT da outra — a
 * request passava no `authMiddleware` (o token é válido) e lia dados da app
 * errada.
 *
 * A chave agora deriva do `appCode` canônico, que o backend já garante único.
 * Ver spec `app-login-redirect`.
 */
const KEY_PREFIX = 'hubthink_auth_token'

/**
 * Chave antiga, compartilhada por todas as apps. **Não é lida como fallback de
 * propósito:** o valor lá pode ser de outra app, e ler reintroduziria
 * exatamente a colisão que esta função corrige. O custo é zero na prática — o
 * iframe do Bitrix executa o login a cada abertura da app.
 */
export const LEGACY_SHARED_TOKEN_KEY = KEY_PREFIX

export const appTokenKey = (appCode: string): string =>
  `${KEY_PREFIX}:${appCode}`

/** `sessionStorage` só existe no cliente; no SSR isto devolve `null`. */
const storage = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    // Storage bloqueado (modo restrito do navegador, iframe sem permissão).
    return null
  }
}

export const readAppToken = (appCode: string): string | null =>
  storage()?.getItem(appTokenKey(appCode)) ?? null

export const writeAppToken = (appCode: string, token: string): void => {
  storage()?.setItem(appTokenKey(appCode), token)
}

export const clearAppToken = (appCode: string): void => {
  storage()?.removeItem(appTokenKey(appCode))
}
