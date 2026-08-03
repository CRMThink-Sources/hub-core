import z from 'zod'
import { Subscription } from '@/modules/application/domain/entities/subscription'
import {
  CreateSubscriptionInput,
  UpdateSubscriptionInput,
} from '@/modules/application/domain/repositories/subscription.repository'
import { env } from '@/config/env'
import { InvalidBitrixSubscriptionError } from '../errors/invalid-bitrix-subscription.error'

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
}

/**
 * Derivado por inversão em tempo de módulo: um mapa só, impossível de
 * dessincronizar do de leitura.
 */
const BITRIX_ID_BY_STATUS = Object.fromEntries(
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
 * `null` e string vazia são rejeitados antes da coerção: `new Date(null)` é
 * epoch e `new Date('')` é `Invalid Date`, e nenhum dos dois pode passar como
 * período válido.
 */
const bitrixDate = z
  .union([z.string().min(1), z.date()])
  .transform(value => (value instanceof Date ? value : new Date(value)))
  .refine(date => !Number.isNaN(date.getTime()), {
    message: 'Data de período inválida',
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
  ufCrm91CurrentPeriodStart: bitrixDate,
  ufCrm91CurrentPeriodEnd: bitrixDate,
  // Opcional na SPA: assinatura ainda não espelhada no gateway não tem id.
  // String vazia é normalizada para `undefined` — o domínio só conhece ausência.
  ufCrm91GatewayId: z
    .string()
    .nullish()
    .transform(value => value || undefined),
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
  if (input.currentPeriodStart !== undefined) {
    fields.ufCrm91CurrentPeriodStart = input.currentPeriodStart.toISOString()
  }
  if (input.currentPeriodEnd !== undefined) {
    fields.ufCrm91CurrentPeriodEnd = input.currentPeriodEnd.toISOString()
  }
  if (input.gatewayId !== undefined) {
    fields.ufCrm91GatewayId = input.gatewayId
  }
  // Só o caminho de criação carrega `aplicationSpaId`: `UpdateSubscriptionInput`
  // omite o campo, e o mapper não o reintroduz.
  if ('aplicationSpaId' in input && input.aplicationSpaId !== undefined) {
    fields[APLICATION_PARENT_FIELD] = input.aplicationSpaId
  }

  return fields
}
