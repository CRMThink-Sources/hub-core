import { getBitrixAppInfoFromUrl } from '@/bitrix'

/**
 * Domínio do portal Bitrix para montar o link do registro no CRM. Primeiro o
 * `BX24.getAuth()` do iframe: depois de navegar dentro do app, a URL não traz
 * mais o `?DOMAIN=` da abertura. O `DOMAIN` da URL fica como reserva (mesma
 * fonte da autenticação). Qualquer que seja a origem, `crmRecordHref` só
 * aceita host de nuvem do Bitrix24; sem domínio, o detalhe mostra texto.
 */
export function resolvePortalHost(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const auth = window.BX24?.getAuth?.()
    if (auth && auth.domain) return auth.domain
  } catch {
    // BX24 ainda não iniciado: segue para a URL.
  }
  return getBitrixAppInfoFromUrl().domain ?? null
}
