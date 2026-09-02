import { env } from '@/config/env'

/**
 * Charset que o Bitrix aceita no `CODE` de um sender de `messageservice`.
 *
 * O id do item da SPA é numérico, então na prática nada é sanitizado — a validação
 * existe para o caso em que a chave da linha deixe de ser numérica: um `CODE`
 * recusado pelo Bitrix vira "falha ao registrar" opaca no admin, e um `CODE`
 * *aceito* mas alterado quebraria a volta (`CODE` → item) sem nenhum sinal.
 */
const SENDER_CODE_CHARSET = /^[a-zA-Z0-9._-]+$/

export class InvalidSmsSenderCodeError extends Error {
  constructor(readonly subscriptionItemId: string) {
    super(
      `O id "${subscriptionItemId}" tem caractere fora de a-zA-Z0-9._- e não pode ` +
        'virar CODE de provedor de mensagem no Bitrix',
    )
    this.name = 'InvalidSmsSenderCodeError'
  }
}

/** Prefixo configurado, sem o separador. */
export function smsSenderCodePrefix(): string {
  return env.bitrix.smsSender.codePrefix
}

/**
 * `subscriptionItemId` → `CODE` do sender (`<prefixo>_<id>`).
 *
 * É a única âncora que sobrevive à ida ao Bitrix: o payload que o handler da campanha
 * recebe não carrega linha, app nem instalação além do `code`, então esta derivação é
 * o que reencontra a linha do outro lado.
 */
export function toSmsSenderCode(subscriptionItemId: string): string {
  if (!SENDER_CODE_CHARSET.test(subscriptionItemId)) {
    throw new InvalidSmsSenderCodeError(subscriptionItemId)
  }

  return `${smsSenderCodePrefix()}_${subscriptionItemId}`
}

/**
 * Separador das partes do `CODE` de um sender **de template**.
 *
 * `.` e não `_`: nome de template da Meta é `a-z0-9_`, então o underscore aparece
 * dentro das partes e a volta seria ambígua — `thinkzap_sms_45_boas_vindas_pt_BR`
 * não tem como ser fatiado com segurança. O ponto está no charset que o Bitrix aceita
 * e não pode ocorrer nem no nome nem no idioma.
 *
 * É também o que distingue as duas famílias de `CODE` sem campo extra: depois do
 * prefixo, `_` é sender de linha e `.` é sender de template.
 */
const TEMPLATE_CODE_SEPARATOR = '.'

/**
 * `(subscriptionItemId, template, idioma)` → `CODE` do sender de template.
 *
 * Um sender por template é o que faz a lista de provedores da campanha **ser** o
 * seletor de template: o payload do handler não carrega template nenhum, e o corpo
 * chega com os placeholders de CRM já resolvidos. Declarar o template no `CODE` é o
 * que sobra — e é determinístico, ao contrário de inferir pelo texto.
 */
export function toSmsTemplateSenderCode(
  subscriptionItemId: string,
  templateName: string,
  language: string,
): string {
  for (const part of [subscriptionItemId, templateName, language]) {
    if (!part || !SENDER_CODE_CHARSET.test(part)) {
      throw new InvalidSmsSenderCodeError(part)
    }

    if (part.includes(TEMPLATE_CODE_SEPARATOR)) {
      throw new InvalidSmsSenderCodeError(part)
    }
  }

  return [
    smsSenderCodePrefix(),
    subscriptionItemId,
    templateName,
    language,
  ].join(TEMPLATE_CODE_SEPARATOR)
}

/** O que um `CODE` nosso identifica. */
export type ParsedSmsSenderCode =
  /** Sender da **linha**: texto livre, hoje só `ZAPI`. */
  | { kind: 'line'; subscriptionItemId: string }
  /** Sender de um **template** de uma linha oficial. */
  | {
      kind: 'template'
      subscriptionItemId: string
      templateName: string
      language: string
    }

/**
 * `CODE` → o que ele identifica, ou `null` quando não é nosso.
 *
 * `null` em vez de lançar porque o caminho principal é a **listagem** do portal do
 * cliente, onde sender de outro app é o caso normal e não um erro.
 */
export function parseSmsSenderCode(code: string): ParsedSmsSenderCode | null {
  const prefix = smsSenderCodePrefix()

  if (code.startsWith(`${prefix}${TEMPLATE_CODE_SEPARATOR}`)) {
    const [, subscriptionItemId, templateName, language, ...rest] = code.split(
      TEMPLATE_CODE_SEPARATOR,
    )

    /** Parte a mais é `CODE` de um formato que este parser não conhece. */
    if (rest.length > 0) return null
    if (!subscriptionItemId || !templateName || !language) return null

    return { kind: 'template', subscriptionItemId, templateName, language }
  }

  if (!code.startsWith(`${prefix}_`)) return null

  const subscriptionItemId = code.slice(prefix.length + 1)

  if (!subscriptionItemId || !SENDER_CODE_CHARSET.test(subscriptionItemId)) {
    return null
  }

  return { kind: 'line', subscriptionItemId }
}

/**
 * O item de assinatura de um `CODE` nosso, de qualquer família.
 *
 * Para quem só precisa saber **de qual linha** o sender é — a listagem, que cruza com
 * as linhas da instalação para achar órfão.
 */
export function fromSmsSenderCode(code: string): string | null {
  return parseSmsSenderCode(code)?.subscriptionItemId ?? null
}
