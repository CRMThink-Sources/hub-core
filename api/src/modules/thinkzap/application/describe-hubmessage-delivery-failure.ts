/**
 * Traduz a recusa da Meta, que a HubMessage repassa no item de estado do callback,
 * para uma frase que diz ao operador **o que fazer**.
 *
 * O motivo chega por duas portas, e nenhuma delas é confiável sozinha:
 *
 * - `external_information.errors[]`, com o código da Cloud API (`131047`) e o texto
 *   da Meta em `title` / `message` / `error_data.details`;
 * - `state.failedDescription`, que traz o corpo HTTP cru da Cloud API dentro de uma
 *   string ("Integration with meta-whatsapp failed (HTTP 400): {\"messaging_product\":...}").
 *
 * Ler só o `failedDescription` foi o defeito que esta tradução tinha: no callback de
 * janela de 24h fechada (2026-08-30) ele veio `null`, o motivo estava no `errors[]`, e
 * o operador recebeu "recusou o envio e não informou o motivo. Verifique a conexão da
 * linha" — conselho que manda mexer justamente no que não tem problema.
 *
 * Resolução em três etapas, nesta ordem: código de erro conhecido (igualdade exata),
 * substring sobre o texto de todas as fontes, texto genérico. O cru **nunca** é
 * descartado: vai sempre para o log estruturado, e no genérico também para o chat,
 * truncado.
 *
 * Padrão de texto casado por substring em minúsculas, não por parse do JSON embutido:
 * o formato do corpo é da Meta, muda sem aviso, e um parse quebrado transformaria
 * "erro traduzido" em "erro ao traduzir o erro".
 */

import type {
  HubMessageDeliveryError,
  HubMessageStateItem,
} from '@/modules/thinkzap/domain/interfaces/hubmessage-events.interface'
import {
  DEFAULT_NOTICE_LOCALE,
  type NoticeLocale,
} from '@/modules/thinkzap/domain/notices/notice-locale'
import {
  type MetaErrorCode,
  deliveryFailureNotices,
} from '@/modules/thinkzap/domain/notices/delivery-failure-notices'

/** Teto do trecho cru que vai ao chat. Linha longa vira parede de texto no canal. */
const RAW_DESCRIPTION_MAX_CHARS = 300

/**
 * Códigos de erro da Cloud API da Meta que têm ação distinta para o operador. As
 * frases, por idioma, estão em `domain/notices/delivery-failure-notices.ts`.
 *
 * Igualdade **exata**, nunca faixa nem prefixo. `132000`–`132016` são todos de
 * template e a tentação é casar `132`, mas um código `132xxx` novo com outro
 * significado receberia a frase de template e mandaria mexer no lugar errado — o
 * mesmo defeito que esta tradução corrige, só com outra pele.
 *
 * Só o `131047` veio de payload observado em produção. Os demais vêm da lista
 * documentada da Cloud API e entram com o peso de uma suposição documentada: é por
 * isso que o casamento por texto continua rodando depois, e não foi substituído por
 * esta tabela. Código errado aqui produz frase errada, não exceção — e o código passou
 * a ir ao log, então a primeira ocorrência de cada um fica auditável.
 */
const KNOWN_META_ERROR_CODES: readonly MetaErrorCode[] = [
  '131047',
  '131026',
  '131048',
  '131049',
  '131051',
  '132000',
  '132001',
  '132015',
  '132016',
]

function isKnownMetaErrorCode(code: string): code is MetaErrorCode {
  return (KNOWN_META_ERROR_CODES as readonly string[]).includes(code)
}

type FailurePattern = {
  /** Todos em minúsculas — a comparação normaliza o texto do erro. */
  match: string[]
  notice: 'displayName' | 'reengagement' | 'invalidRecipient' | 'rateLimit'
}

const PATTERNS: FailurePattern[] = [
  {
    match: ['display name approval', 'display name'],
    notice: 'displayName',
  },
  {
    match: [
      're-engagement',
      'reengagement',
      '24 hours',
      '24 horas',
      'outside the allowed window',
      'conversation window',
    ],
    notice: 'reengagement',
  },
  {
    match: [
      'not a valid whatsapp user',
      'not a whatsapp user',
      'invalid phone',
      'invalid recipient',
      'recipient phone number not in allowed list',
    ],
    notice: 'invalidRecipient',
  },
  {
    match: ['rate limit', 'throughput', 'too many requests', 'limit reached'],
    notice: 'rateLimit',
  },
]

/**
 * Os erros da Meta dentro do item de estado, sempre como array.
 *
 * `Array.isArray` e não confiança no tipo: o payload vem de webhook externo, e um
 * `errors` que chegasse como objeto viraria `undefined.length` em produção.
 */
export function readMetaErrors(
  stateItem: HubMessageStateItem | undefined,
): HubMessageDeliveryError[] {
  const errors = stateItem?.external_information?.errors
  if (!Array.isArray(errors)) return []
  return errors.filter(
    (error): error is HubMessageDeliveryError =>
      typeof error === 'object' && error !== null,
  )
}

/**
 * O primeiro código presente em `errors[]`, mapeado ou não.
 *
 * Serve ao log: registrar `131099` desconhecido é o que permite descobrir que ele
 * existe e merece uma linha na tabela. Para a tradução vale a busca por conhecido
 * (abaixo), que é outra coisa.
 */
export function readMetaErrorCode(
  stateItem: HubMessageStateItem | undefined,
): string | undefined {
  for (const error of readMetaErrors(stateItem)) {
    const code = normalizeCode(error.code)
    if (code) return code
  }
  return undefined
}

/**
 * O primeiro código **mapeado**, varrendo todos os erros e não só o primeiro.
 *
 * Um `errors[]` com dois itens onde só o segundo é conhecido tem de ser traduzido pelo
 * segundo; parar no primeiro faria a ordem do array decidir se o operador recebe uma
 * frase útil ou o texto genérico.
 */
function findKnownMetaErrorCode(
  errors: HubMessageDeliveryError[],
): MetaErrorCode | undefined {
  for (const error of errors) {
    const code = normalizeCode(error.code)
    if (code && isKnownMetaErrorCode(code)) return code
  }
  return undefined
}

/**
 * `code` chega como string no payload observado, mas a Cloud API o documenta como
 * número — os dois são aceitos e normalizados para string, que é a chave da tabela.
 */
function normalizeCode(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'string' && value.trim()) return value.trim()
  return undefined
}

/**
 * Todo o texto disponível sobre a falha, unido por espaço: `title`, `message` e
 * `error_data.details` de **cada** erro, mais o `failedDescription`.
 *
 * Concatena em vez de escolher o "melhor" campo: eles são redundantes entre si em
 * graus que variam por erro (`title` e `message` vieram idênticos no `131047`), e
 * escolher exigiria saber de antemão qual vem preenchido em cada caso. Repetição não
 * cria termo novo, então concatenar não inventa casamento de substring.
 */
export function buildFailureText(
  stateItem: HubMessageStateItem | undefined,
): string {
  /** Aceita `undefined` na coleta; o filtro abaixo é quem estreita para `string`. */
  const parts: Array<string | undefined> = []

  for (const error of readMetaErrors(stateItem)) {
    parts.push(error.title, error.message, error.error_data?.details)
  }
  parts.push(stateItem?.state?.failedDescription)

  return parts
    .filter((part): part is string => typeof part === 'string' && !!part.trim())
    .map(part => part.trim())
    .join(' ')
}

/**
 * Frase pronta para postar no chat do canal aberto.
 *
 * Sem nenhuma fonte de motivo (callback de erro sem `errors[]` e sem
 * `failedDescription`) ainda produz aviso: "não foi entregue e não sabemos por quê" é
 * informação, e o silêncio é pior.
 *
 * No idioma da instalação; o retorno cru do provedor, na genérica, segue como veio.
 */
export function describeHubMessageDeliveryFailure(
  stateItem: HubMessageStateItem | undefined,
  locale: NoticeLocale = DEFAULT_NOTICE_LOCALE,
): string {
  const notices = deliveryFailureNotices(locale)
  const errors = readMetaErrors(stateItem)
  const text = buildFailureText(stateItem)

  const knownCode = findKnownMetaErrorCode(errors)
  if (knownCode) return notices.prefix + notices.byCode[knownCode]

  if (!text) return notices.prefix + notices.noReason

  const haystack = text.toLowerCase()
  const pattern = PATTERNS.find(({ match }) =>
    match.some(term => haystack.includes(term)),
  )

  if (pattern) return notices.prefix + notices[pattern.notice]

  /**
   * Genérico com o código à vista quando houver um: "erro 131099" é um número
   * pesquisável na documentação da Meta, e é a única coisa acionável que sobra quando
   * nem o código nem o texto são reconhecidos.
   */
  const code = readMetaErrorCode(stateItem)

  return (
    notices.prefix +
    notices.generic(code, truncate(text, RAW_DESCRIPTION_MAX_CHARS))
  )
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`
}
