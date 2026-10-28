import z from 'zod'
import {
  Subscription,
  SubscriptionModality,
} from '@/modules/application/domain/entities/subscription'
import {
  CreateSubscriptionInput,
  UpdateSubscriptionInput,
} from '@/modules/application/domain/repositories/subscription.repository'
import { ExpirableSubscription } from '@/modules/application/domain/subscription-expiration'
import { env } from '@/config/env'
import { apiLogger } from '@/shared/infra/logger'
import { SUBSCRIPTION_MODALITY_FIELD } from '../ensure-subscription-modality-field'
import { InvalidBitrixSubscriptionError } from '../errors/invalid-bitrix-subscription.error'
import {
  type CalendarDate,
  endOfCalendarDay,
  parseSpaCalendarDate,
  startOfCalendarDay,
  toSpaCalendarDateValue,
} from '../spa-calendar-date'

/**
 * Assinatura como sai da SPA: plano e aplicação ainda são só ids.
 * A hidratação para `Subscription` acontece no repositório, que tem acesso ao
 * `PlanRepository` e ao `AplicationRepository` — o mapper fica puro e síncrono.
 *
 * Sem `productId`: a SPA 1142 não tem campo de produto. O produto cobrado chega
 * por `plan.product`, resolvido na hidratação do plano.
 */
export type RawSubscription = Omit<Subscription, 'plan' | 'aplication'> & {
  planId: string
  /** Id do item da SPA 1060 (o espelho da aplicação), não o uuid de `core_apps`. */
  aplicationSpaId: string
}

/**
 * Nome do campo parent da SPA de aplicação, montado a partir do env para que a
 * string `parentId1060` não apareça literal em duas camadas.
 */
export const APLICATION_PARENT_FIELD =
  `parentId${env.payments.spa.aplicationEntityType}` as const

/**
 * IDs do campo de lista `UF_CRM_91_STATUS` na SPA de assinaturas.
 * São `isDynamic: true`, ou seja, gerados por este portal — se a SPA for
 * recriada ou migrada, este mapa precisa ser refeito.
 */
const STATUS_BY_BITRIX_ID: Record<string, Subscription['status']> = {
  '13617': 'active', // Ativo
  '13619': 'trialing', // Em teste
  '13621': 'past_due', // Vencido
  '13623': 'cancelled', // Cancelado
  '14353': 'trial_expired', // Teste expirado
}

/**
 * Derivado por inversão em tempo de módulo: um mapa só, impossível de
 * dessincronizar do de leitura.
 */
export const BITRIX_ID_BY_STATUS = Object.fromEntries(
  Object.entries(STATUS_BY_BITRIX_ID).map(([id, status]) => [status, id]),
) as Record<Subscription['status'], string>

/**
 * ID de enum desconhecido ou ausente é erro de configuração, não motivo para
 * assumir um status default — `'active'` daria acesso a assinatura cancelada e
 * `'cancelled'` cortaria acesso pago.
 */
const bitrixStatus = z
  .unknown()
  .transform((raw, ctx): Subscription['status'] => {
    const status = STATUS_BY_BITRIX_ID[String(raw)]

    if (!status) {
      ctx.addIssue({
        code: 'custom',
        message: `Status de assinatura desconhecido: ${JSON.stringify(raw)}`,
      })
      return z.NEVER
    }

    return status
  })

const MODALITIES: readonly SubscriptionModality[] = ['stripe', 'manual']

/**
 * Modalidade da SPA → domínio, **tolerante de propósito**.
 *
 * Diferente de `ufCrm91Status`, valor ausente, vazio ou desconhecido não é erro:
 * resolve `manual`. A modalidade diz como a assinatura é cobrada, não se ela
 * vale — reprovar o item por causa dela derrubaria a leitura do contexto inteiro
 * da instalação por um campo que nenhum caminho de habilitação consulta.
 *
 * Ausente e vazio são silenciosos: é o estado de toda assinatura criada antes do
 * campo existir. Valor **desconhecido** é `warn`, porque aí alguém digitou algo
 * no CRM que o produto não entende, e a consequência (cliente do gateway sem
 * portal de faturamento) não aparece em nenhum outro lugar.
 */
const bitrixModality = z.unknown().transform((raw): SubscriptionModality => {
  if (raw === undefined || raw === null || raw === '') return 'manual'

  /**
   * Só escalar vira texto. O campo é de texto na SPA, mas um campo de lista
   * multivalorado devolveria array e um objeto viraria `[object Object]` no log —
   * inútil justamente para o caso que este `warn` existe para diagnosticar.
   * `JSON.stringify` preserva o que chegou de verdade.
   */
  const value =
    typeof raw === 'string' || typeof raw === 'number'
      ? String(raw)
      : JSON.stringify(raw)

  if ((MODALITIES as readonly string[]).includes(value)) {
    return value as SubscriptionModality
  }

  apiLogger.warn(
    { app: 'shared', field: SUBSCRIPTION_MODALITY_FIELD, value },
    'Modalidade de assinatura desconhecida — resolvendo como manual',
  )

  return 'manual'
})

/**
 * Referência escalar obrigatória (campo parent, id de plano e id de produto). O
 * Bitrix devolve parent como número, então coage — mas `null`, `0` e string
 * vazia são rejeitados: assinatura sem plano, sem produto ou sem dono não é
 * cobrável.
 */
const bitrixRequiredRef = z
  .union([z.string().min(1), z.number()])
  .transform(String)
  .refine(value => value !== '0', {
    message: 'Referência obrigatória ausente',
  })

/**
 * Data de período: **dia de calendário**, não instante.
 *
 * O valor da SPA vem no fuso do portal (`2026-08-01T00:00:00+03:00`), e o antigo
 * `new Date(valor)` guardava o instante — `2026-07-31T21:00:00Z` —, que qualquer
 * leitor a oeste do portal formatava como o dia anterior. `parseSpaCalendarDate`
 * lê o dia do offset que a própria string carrega; a âncora resolve para onde
 * dentro do dia. Ver `../spa-calendar-date.ts`.
 *
 * `null`, string vazia e data inválida continuam rejeitados: são `null` do parser,
 * e o issue reprova o item como antes.
 */
const bitrixCalendarDate = (anchor: (date: CalendarDate) => Date) =>
  z.unknown().transform((raw, ctx): Date => {
    const day = parseSpaCalendarDate(raw)

    if (!day) {
      ctx.addIssue({ code: 'custom', message: 'Data de período inválida' })
      return z.NEVER
    }

    return anchor(day)
  })

/** Início do dia: o período começa no primeiro instante do dia informado. */
const bitrixPeriodStart = bitrixCalendarDate(startOfCalendarDay)

/**
 * Fim do dia: um período que vai até o dia 1º inclui o dia 1º inteiro, e ancorar
 * na meia-noite cortaria 24 horas contratadas.
 */
const bitrixPeriodEnd = bitrixCalendarDate(endOfCalendarDay)

/**
 * Data de controle opcional ("Vencido em"): vazio é `null`, não erro — é o estado de
 * toda assinatura que nunca venceu. Valor presente e inválido reprova o item, como
 * as datas de período.
 */
const bitrixOptionalCalendarDay = z
  .unknown()
  .transform((raw, ctx): Date | null => {
    if (raw === undefined || raw === null || raw === '') return null
    const day = parseSpaCalendarDate(raw)
    if (!day) {
      ctx.addIssue({ code: 'custom', message: 'Data de controle inválida' })
      return z.NEVER
    }
    return startOfCalendarDay(day)
  })

const bitrixSubscriptionSchema = z.object({
  id: z.coerce.string(),
  title: z.string(),
  /**
   * Campo `crm` apontando para a SPA de planos (`settings: { DYNAMIC_1138: "Y" }`),
   * devolvido como id nu — não `"1138_<id>"`. Não há campo de produto na SPA:
   * `crm.item.fields` da 1142 lista só `ufCrm91Client`, `ufCrm91Status`,
   * `ufCrm91CurrentPeriodStart`, `ufCrm91CurrentPeriodEnd`, `ufCrm91CanceledAt`,
   * `ufCrm91GatewayId` e `ufCrm91Plan`.
   */
  ufCrm91Plan: bitrixRequiredRef,
  /**
   * O vínculo com a aplicação é o **parent**, não o campo `ufCrm91Client` (que
   * também aponta para a 1060): é o parent que a SPA preenche e o que
   * `crm.item.list` filtra.
   */
  [APLICATION_PARENT_FIELD]: bitrixRequiredRef,
  ufCrm91Status: bitrixStatus,
  ufCrm91CurrentPeriodStart: bitrixPeriodStart,
  ufCrm91CurrentPeriodEnd: bitrixPeriodEnd,
  // Opcional na SPA: assinatura ainda não espelhada no gateway não tem id.
  // String vazia é normalizada para `undefined` — o domínio só conhece ausência.
  ufCrm91GatewayId: z
    .string()
    .nullish()
    .transform(value => value || undefined),
  /**
   * Campo de **texto**, não de lista: campo de lista devolveria id de enum, e a
   * leitura literal resolveria `manual` para toda assinatura Stripe.
   * `ensureSubscriptionModalityField` reprova esse caso antes da primeira escrita.
   *
   * Sem `.optional()` no `z.unknown()`: chave ausente já chega como `undefined`,
   * e o transform trata — é o caso de toda assinatura anterior a este campo.
   */
  [SUBSCRIPTION_MODALITY_FIELD]: bitrixModality,
})

export const mapBitrixSpaSubscriptionToRawSubscription = (
  raw: unknown,
): RawSubscription => {
  const parsed = bitrixSubscriptionSchema.safeParse(raw)

  if (!parsed.success) {
    throw new InvalidBitrixSubscriptionError(parsed.error.issues)
  }

  return {
    id: parsed.data.id,
    name: parsed.data.title,
    planId: parsed.data.ufCrm91Plan,
    aplicationSpaId: parsed.data[APLICATION_PARENT_FIELD],
    status: parsed.data.ufCrm91Status,
    currentPeriodStart: parsed.data.ufCrm91CurrentPeriodStart,
    currentPeriodEnd: parsed.data.ufCrm91CurrentPeriodEnd,
    gatewayId: parsed.data.ufCrm91GatewayId,
    modality: parsed.data[SUBSCRIPTION_MODALITY_FIELD],
  }
}

/**
 * Recorte do schema para a varredura de expiração: só id, status, fim do período e
 * modalidade. Mesmos validadores da leitura completa — um status desconhecido ou
 * uma data inválida reprova aqui pelo mesmo motivo que reprovaria lá.
 */
const bitrixExpirableSubscriptionSchema = bitrixSubscriptionSchema
  .pick({
    id: true,
    ufCrm91Status: true,
    ufCrm91CurrentPeriodEnd: true,
    [SUBSCRIPTION_MODALITY_FIELD]: true,
  })
  .extend({ ufCrm91PastDueAt: bitrixOptionalCalendarDay })

/** Os campos que `crm.item.list` precisa devolver para o recorte acima. */
export const EXPIRABLE_SUBSCRIPTION_SELECT = [
  'id',
  'ufCrm91Status',
  'ufCrm91CurrentPeriodEnd',
  SUBSCRIPTION_MODALITY_FIELD,
  'ufCrm91PastDueAt',
]

export const mapBitrixSpaSubscriptionToExpirable = (
  raw: unknown,
): ExpirableSubscription => {
  const parsed = bitrixExpirableSubscriptionSchema.safeParse(raw)

  if (!parsed.success) {
    throw new InvalidBitrixSubscriptionError(parsed.error.issues)
  }

  return {
    id: parsed.data.id,
    status: parsed.data.ufCrm91Status,
    currentPeriodEnd: parsed.data.ufCrm91CurrentPeriodEnd,
    modality: parsed.data[SUBSCRIPTION_MODALITY_FIELD],
    pastDueAt: parsed.data.ufCrm91PastDueAt,
  }
}

export const collectBitrixSpaSubscriptionToRawSubscription = (
  raw: unknown[],
): RawSubscription[] => {
  return raw.map(mapBitrixSpaSubscriptionToRawSubscription)
}

/**
 * Domínio → campos da SPA, para `crm.item.add` e `crm.item.update`.
 * Campo ausente na entrada é **omitido** do payload, nunca enviado como `null`
 * — sem isso, `updateSubscription` apagaria os campos que o patch não menciona.
 */
export const mapSubscriptionInputToBitrixFields = (
  input: Partial<CreateSubscriptionInput> | UpdateSubscriptionInput,
): Record<string, unknown> => {
  const fields: Record<string, unknown> = {}

  if (input.name !== undefined) fields.title = input.name
  if (input.planId !== undefined) fields.ufCrm91Plan = input.planId
  if (input.status !== undefined) {
    fields.ufCrm91Status = BITRIX_ID_BY_STATUS[input.status]
  }
  /**
   * Dia de calendário, não instante. `.toISOString()` cru mandava a hora real, e o
   * Bitrix a lê no fuso do portal — uma escrita perto da virada do dia gravava o
   * dia seguinte. `toSpaCalendarDateValue` mantém o mesmo formato ISO que a SPA já
   * aceita e ancora no meio-dia, que é o único horário estável em todo offset.
   */
  if (input.currentPeriodStart !== undefined) {
    fields.ufCrm91CurrentPeriodStart = toSpaCalendarDateValue(
      input.currentPeriodStart,
    )
  }
  if (input.currentPeriodEnd !== undefined) {
    fields.ufCrm91CurrentPeriodEnd = toSpaCalendarDateValue(
      input.currentPeriodEnd,
    )
  }
  if (input.gatewayId !== undefined) {
    fields.ufCrm91GatewayId = input.gatewayId
  }
  /**
   * Datas de controle da verificação de assinaturas, também dia de calendário. `null`
   * em "Vencido em" vira string vazia, que é como o Bitrix limpa um campo de data.
   */
  if ('pastDueAt' in input && input.pastDueAt !== undefined) {
    fields.ufCrm91PastDueAt =
      input.pastDueAt === null ? '' : toSpaCalendarDateValue(input.pastDueAt)
  }
  if ('canceledAt' in input && input.canceledAt !== undefined) {
    fields.ufCrm91CanceledAt = toSpaCalendarDateValue(input.canceledAt)
  }
  /**
   * Escrita **explícita**, ao contrário da leitura tolerante: modalidade não
   * informada é omitida do payload, nunca gravada como `'manual'`. Assumir aqui
   * faria um patch de status reescrever a modalidade de uma assinatura Stripe.
   */
  if (input.modality !== undefined) {
    fields[SUBSCRIPTION_MODALITY_FIELD] = input.modality
  }
  // Só o caminho de criação carrega `aplicationSpaId`: `UpdateSubscriptionInput`
  // omite o campo, e o mapper não o reintroduz.
  if ('aplicationSpaId' in input && input.aplicationSpaId !== undefined) {
    fields[APLICATION_PARENT_FIELD] = input.aplicationSpaId
  }

  return fields
}
