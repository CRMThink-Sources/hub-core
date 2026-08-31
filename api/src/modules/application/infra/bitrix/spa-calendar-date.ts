/**
 * Conversão entre a **data de calendário** da SPA e o domínio.
 *
 * `currentPeriodStart` e `currentPeriodEnd` não são instantes: são dias escolhidos
 * no CRM ("o período vai até o dia 1º"). Todo `Date` é um instante, e transformar
 * dia em instante — e de volta — exige um fuso. O bug de D-1 era cada camada
 * escolher o seu:
 *
 * | Camada | Fuso | "dia 1º de agosto" virava |
 * | --- | --- | --- |
 * | SPA (leitura) | do portal, UTC+3 | `2026-08-01T00:00:00+03:00` |
 * | `new Date(valor)` | nenhum — guarda o instante | `2026-07-31T21:00:00Z` |
 * | tela, `toLocaleDateString` | do navegador, UTC-3 | **31/07** |
 *
 * Este módulo é o único ponto que faz a conversão, nas duas direções.
 *
 * **A convenção:** o componente **UTC** do `Date` é o dia de calendário, e a hora
 * é só âncora. UTC é o carrier porque é o único fuso que atravessa JSON, Redis e
 * navegador sem tradução — ancorar no fuso de negócio obrigaria todo leitor a
 * conhecê-lo para recuperar o dia, que é o acoplamento que produziu o bug.
 */

/** Um dia de calendário, sem fuso e sem hora. */
export type CalendarDate = {
  year: number
  /** 1–12, como se escreve, não como o `Date` indexa. */
  month: number
  day: number
}

/**
 * Prefixo `YYYY-MM-DD` de uma string ISO.
 *
 * É daqui que sai o dia, e não de `new Date(...)`: numa string com offset, a parte
 * da data **já é** a data local naquele offset. `2026-08-01T00:00:00+03:00` diz
 * "dia 1º, no fuso +03:00", e o dia denotado é 1º sem nenhuma aritmética. Passar
 * pelo instante e pedir os componentes UTC é justamente o que devolve dia 31.
 */
const ISO_DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/

/** Componentes UTC de um `Date` — usados quando o dia já está ancorado em UTC. */
const fromUtc = (date: Date): CalendarDate => ({
  year: date.getUTCFullYear(),
  month: date.getUTCMonth() + 1,
  day: date.getUTCDate(),
})

/**
 * O dia de calendário que um valor da SPA denota, ou `null` quando não denota
 * nenhum.
 *
 * Devolve `null` em vez de lançar: quem chama é um schema de validação, e ele já
 * sabe transformar ausência em `InvalidBitrixSubscriptionError` com o issue certo.
 */
export function parseSpaCalendarDate(value: unknown): CalendarDate | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : fromUtc(value)
  }

  if (typeof value !== 'string' || value.trim() === '') return null

  const iso = ISO_DATE_PREFIX.exec(value)
  if (iso) {
    const [, year, month, day] = iso
    const candidate = {
      year: Number(year),
      month: Number(month),
      day: Number(day),
    }

    /**
     * `2026-02-31` casa com o regex e não existe. A ida e volta por `Date.UTC`
     * pega isso: o mês transbordado devolve componentes diferentes dos que
     * entraram.
     */
    const roundTrip = fromUtc(
      new Date(Date.UTC(candidate.year, candidate.month - 1, candidate.day)),
    )

    return roundTrip.year === candidate.year &&
      roundTrip.month === candidate.month &&
      roundTrip.day === candidate.day
      ? candidate
      : null
  }

  /**
   * Formato que não é ISO — o Bitrix pode devolver conforme a configuração
   * regional do portal. Sem o prefixo para ler, sobra delegar ao motor e usar os
   * componentes UTC. Menos preciso, e é o caminho de exceção.
   */
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : fromUtc(parsed)
}

/** Início do dia, em UTC. A âncora de `currentPeriodStart`. */
export function startOfCalendarDay(date: CalendarDate): Date {
  return new Date(Date.UTC(date.year, date.month - 1, date.day, 0, 0, 0, 0))
}

/**
 * Fim do dia, em UTC. A âncora de `currentPeriodEnd`.
 *
 * Fim, e não início: um período que vai até o dia 1º inclui o dia 1º inteiro, e
 * ancorar na meia-noite cortaria 24 horas que o cliente contratou.
 *
 * **Esta é a única escolha do módulo que depende de o campo da SPA ser `date` e
 * não `datetime`.** Se a hora tiver significado lá, o fim do dia é generoso demais
 * — e é uma linha para trocar, de propósito isolada aqui.
 */
export function endOfCalendarDay(date: CalendarDate): Date {
  return new Date(
    Date.UTC(date.year, date.month - 1, date.day, 23, 59, 59, 999),
  )
}

const pad = (value: number) => String(value).padStart(2, '0')

/** O dia de calendário de um `Date` ancorado em UTC, como `YYYY-MM-DD`. */
export const formatCalendarDate = (date: Date): string =>
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`

/**
 * O valor a **escrever** na SPA: o mesmo ISO completo de sempre, com o instante no
 * **meio-dia UTC** do dia.
 *
 * O formato do fio não muda de propósito. `crm.item.update` aceita valor que não
 * entende, responde sucesso e descarta — trocar para `YYYY-MM-DD` sem poder
 * verificar contra o portal arriscaria gravar data vazia sem erro, sem log e sem
 * rastro.
 *
 * O que muda é a hora dentro do dia. Meio-dia é o único horário estável: lido em
 * UTC+3 é 15:00 do mesmo dia, lido em UTC-3 é 09:00 do mesmo dia, e só um portal a
 * mais de 12 horas de UTC mudaria o dia — não existe. A meia-noite, que era o que
 * estava lá, é justamente o horário que qualquer offset negativo joga para o dia
 * anterior. O bug era escolher a borda do dia; a correção é escolher o meio.
 */
export function toSpaCalendarDateValue(date: Date): string {
  const day = startOfCalendarDay(fromUtc(date))
  return new Date(day.getTime() + 12 * 60 * 60 * 1000).toISOString()
}
