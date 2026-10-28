/**
 * Duas funções, dois tipos de dado. Trocar uma pela outra é o bug de D-1.
 *
 * `formatPortalDate` → **instantes**: `createdAt`, `installedAt`, `lastRunAt`. Uma
 * hora que aconteceu, e o fuso de quem olha é a resposta certa para ela.
 *
 * `formatSpaDate` → **dias de calendário**: `currentPeriodStart`,
 * `currentPeriodEnd`. Um dia escolhido no CRM, que a api entrega ancorado em UTC.
 * Formatar um dia no fuso de quem olha faz o dia mudar.
 */

/**
 * Data de período da assinatura, formatada no fuso da âncora.
 *
 * `timeZone: 'UTC'` não é redundância nem descuido: a api ancora estes valores no
 * componente UTC do `Date` (`Subscription.currentPeriodStart`), e sem nomear o fuso
 * o navegador reinterpreta. Um `2026-08-01T23:59:59.999Z` lido em `America/Sao_Paulo`
 * é 20:59 do dia 1º — coincide —, mas em qualquer fuso a leste vira dia 2. A âncora
 * e o formatador têm que concordar sobre o fuso, e a única forma de garantir isso é
 * os dois nomearem o mesmo.
 *
 * `locale` `undefined` usa o do navegador, que é o do operador. **Fuso e locale são
 * coisas diferentes:** o locale decide `01/08` ou `08/01`, o fuso decide *qual dia*.
 * O primeiro é de quem olha; o segundo, do contrato.
 *
 * Data inválida volta crua, para a tela renderizar o resto sem quebrar.
 */
export function formatSpaDate(iso: string, locale?: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }

  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

/**
 * Timestamp de portal — um instante — no fuso e no locale de quem olha.
 *
 * **Não** use para data de período: veja `formatSpaDate`.
 */
export function formatPortalDate(iso: string, locale?: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }

  return new Intl.DateTimeFormat(locale ?? 'pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

/**
 * Instante relativo a `now` ("há 12 minutos", "há 3 horas") no locale de quem olha.
 * Para recência — a última rodada de um job; a data absoluta fica no `title`.
 *
 * Abaixo de um minuto vira "agora": segundos mudam a cada render e não dizem nada.
 */
export function formatRelativeInstant(
  iso: string,
  now: Date,
  locale?: string,
): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }

  const format = new Intl.RelativeTimeFormat(locale ?? 'pt-BR', {
    numeric: 'auto',
  })
  const diffSeconds = Math.round((date.getTime() - now.getTime()) / 1000)
  const abs = Math.abs(diffSeconds)

  if (abs < 60) return format.format(0, 'second')
  if (abs < 60 * 60)
    return format.format(Math.round(diffSeconds / 60), 'minute')
  if (abs < 24 * 60 * 60) {
    return format.format(Math.round(diffSeconds / 3600), 'hour')
  }
  return format.format(Math.round(diffSeconds / 86400), 'day')
}
