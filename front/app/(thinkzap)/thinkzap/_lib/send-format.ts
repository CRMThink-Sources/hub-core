/**
 * A API devolve a frase genérica de motivo em minúsculas ("motivo não
 * informado") porque ela também entra no meio de comentários do CRM. Na tela
 * ela abre a linha, então a primeira letra sobe. `toLocaleUpperCase` cuida de
 * acentos ("é", "ó"); um texto vazio fica vazio.
 */
export function capitalizeFirst(text: string): string {
  if (!text) return text
  const [first = ''] = Array.from(text)
  return first.toLocaleUpperCase() + text.slice(first.length)
}

/**
 * Domínios de nuvem do Bitrix24 (`<portal>.bitrix24.<tld>`). Portais com
 * domínio próprio e instalações on-premise ficam DE FORA de propósito: o host
 * vem do parâmetro `DOMAIN` da URL do iframe, que é livre, e sem lista
 * fechada um host estrangeiro viraria link clicável. Esses portais mostram o
 * registro como texto, sem link.
 */
export const BITRIX_CLOUD_TLDS = [
  'com',
  'com.br',
  'es',
  'de',
  'fr',
  'it',
  'pl',
  'ru',
  'ua',
  'by',
  'kz',
  'in',
  'eu',
  'uk',
  'co.uk',
  'com.tr',
  'tr',
  'cn',
  'jp',
  'vn',
  'id',
  'th',
  'mx',
  'la',
  'ae',
  'co',
  'nl',
  'br',
  'tc',
  'ch',
] as const

const LABEL = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?'
const TLDS = BITRIX_CLOUD_TLDS.map(t => t.replace(/\./g, '\\.')).join('|')
const CLOUD_HOST_RE = new RegExp(
  `^${LABEL}(?:\\.${LABEL})*\\.bitrix24\\.(?:${TLDS})$`,
)
const CRM_PATH_RE = /^\/crm\/[A-Za-z0-9/_-]+$/

/**
 * Link absoluto para o registro no CRM, ou `null` quando não dá para montar
 * com segurança (o chamador mostra texto puro). A API devolve só o caminho
 * relativo (`/crm/deal/details/1/`); o domínio vem do `?DOMAIN=` do iframe
 * (`getBitrixAppInfoFromUrl().domain`) e só vale se for host de nuvem
 * Bitrix24 (ver `BITRIX_CLOUD_TLDS`). O caminho precisa ser `/crm/...`
 * simples, sem `..`, `//`, barra invertida, esquema, query ou hash: nunca se
 * devolve a url crua, para ela não virar redirecionamento aberto.
 */
export function crmRecordHref(
  portalHost: string | null | undefined,
  url: string,
): string | null {
  const host = (portalHost ?? '').trim().toLowerCase()
  if (host.length > 253 || !CLOUD_HOST_RE.test(host)) return null
  if (!CRM_PATH_RE.test(url) || url.includes('//')) return null
  return `https://${host}${url}`
}
