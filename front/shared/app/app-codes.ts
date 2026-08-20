/**
 * Codes canônicos das apps do hub.
 *
 * São os mesmos valores de `core_app_codes.code` no api, e são estáveis — não
 * vêm de env. O code que o Bitrix devolve em `app.info` (que *pode* variar por
 * ambiente) não aparece aqui: o front manda esse valor para `POST /api/auth` e
 * recebe de volta o canônico. Quem traduz é o catálogo do api.
 *
 * Antes desta tabela o front decidia rota e chave de storage a partir de
 * `NEXT_PUBLIC_*_APP_CODE` cruzado com um mapa local — três fontes de verdade
 * para a mesma pergunta. Ver spec `app-login-redirect`.
 */
export const APP_CODES = {
  thinkzap: 'crmthink.thinkzap',
  thinkanalise: 'crmthink.thinkanalise',
  importsheet: 'crmthink.importsheet',
  clicksign: 'crmthink.clicksign',
} as const

export type AppCode = (typeof APP_CODES)[keyof typeof APP_CODES]

/** Identidade da app resolvida pelo backend em `POST /api/auth`. */
export type ResolvedApp = {
  appCode: string
  appCodeId: string
  slug: string
  requiresOperatorOAuth: boolean
}

/**
 * Rota de entrada da app a partir do `slug` devolvido pelo backend. O front não
 * escolhe o destino — só monta o caminho.
 */
export const appRoute = (slug: string): string => `/${slug.replace(/^\/+/, '')}`
