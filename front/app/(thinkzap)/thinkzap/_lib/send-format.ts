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
 * Link absoluto para o registro no CRM. A API devolve só o caminho relativo ao
 * portal (`/crm/deal/details/1/`) porque não conhece o host que o usuário
 * abriu. O front sabe: o Bitrix abre o app em iframe com `?DOMAIN=` na URL
 * (`getBitrixAppInfoFromUrl().domain`).
 *
 * Sem domínio confiável devolve o caminho relativo (dentro do iframe ele
 * resolveria contra o host do app, não do portal, então o chamador pode
 * preferir mostrar só o texto). Só aceita caminho que começa com uma barra e um
 * host que seja apenas nome de domínio: nada de esquema, porta ou caminho
 * vindo da URL, para o link não virar redirecionamento aberto.
 */
export function crmRecordHref(
  portalHost: string | null | undefined,
  url: string,
): string {
  const host = (portalHost ?? '').trim()
  const isHostname = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i.test(host)
  if (!isHostname || !url.startsWith('/') || url.startsWith('//')) return url
  return `https://${host}${url}`
}
