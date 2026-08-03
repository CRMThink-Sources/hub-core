import z from 'zod'
import { Plan } from '@/modules/application/domain/entities/plan'
import { env } from '@/config/env'
import { InvalidBitrixPlanError } from '../errors/invalid-bitrix-plan.error'

/**
 * Plano como sai da SPA: o produto ainda é só uma referência.
 * A hidratação para `Plan` acontece no repositório, que tem acesso ao
 * `ProductRepository` — o mapper fica puro e síncrono.
 */
export type RawPlan = Omit<Plan, 'product'> & { productId: string }

/**
 * IDs do campo de lista `UF_CRM_89_INTERVAL` na SPA de planos.
 * São `isDynamic: true`, ou seja, gerados por este portal — se a SPA for
 * recriada ou migrada, este mapa precisa ser refeito.
 */
const INTERVAL_BY_BITRIX_ID: Record<string, Plan['interval']> = {
  '13609': 'monthly', // Mensal
  '13611': 'quarterly', // Trimestral
  '13613': 'semiannual', // Semestral
  '13615': 'yearly', // Anual
}

/** Campo booleano do Bitrix: a API nova devolve boolean, a antiga 'Y'/'N'. */
const bitrixBoolean = z
  .union([z.boolean(), z.literal('Y'), z.literal('N'), z.null()])
  .transform(value => value === true || value === 'Y')

/**
 * ID de enum desconhecido é erro de configuração, não motivo para assumir
 * um ciclo default — cobrar no intervalo errado é pior que falhar a leitura.
 */
const bitrixInterval = z.unknown().transform((raw, ctx): Plan['interval'] => {
  const interval = INTERVAL_BY_BITRIX_ID[String(raw)]

  if (!interval) {
    ctx.addIssue({
      code: 'custom',
      message: `Intervalo de cobrança desconhecido: ${JSON.stringify(raw)}`,
    })
    return z.NEVER
  }

  return interval
})

/**
 * Campo do tipo `crm` aponta para outra entidade. A definição do campo já fixa o
 * alvo — `UF_CRM_89_PRODUCT` tem `settings: { DYNAMIC_1134: "Y" }` — e o portal
 * devolve o **id nu** (`"1"`), não `"<entityTypeId>_<id>"`.
 *
 * Confirmado em produção contra `crm.item.fields`/`crm.item.get` da SPA 1138.
 * A versão anterior exigia o prefixo e rejeitava todo plano real; a checagem de
 * `entityTypeId` que ela fazia não tinha o que checar, porque o valor não carrega
 * entidade. Quem garante o alvo é o cadastro do campo, não o payload.
 *
 * Mesma regra que o mapper de assinatura já aplica a `ufCrm91Plan`, que também é
 * tipo `crm` — os dois tratamentos de campo `crm` ficam iguais.
 *
 * `null`, `0` e string vazia são rejeitados: plano sem produto não é cobrável.
 */
const bitrixProductRef = z
  .union([z.string().min(1), z.number()])
  .transform(String)
  .refine(value => value !== '0', {
    message: 'Referência de produto ausente',
  })

/**
 * `UF_CRM_89_VALUE` é `type: "integer"` e guarda centavos — decimal aqui é
 * cadastro errado, não arredondamento, então `4.99` falha em vez de virar
 * R$ 0,04. `null` e string vazia são rejeitados antes da coerção: ambos
 * virariam `0` sob `Number()`, e um plano sem valor passaria como grátis.
 */
const bitrixAmount = z
  .union([z.number(), z.string().min(1)])
  .transform(Number)
  .pipe(z.number().int().nonnegative())

const bitrixPlanSchema = z.object({
  id: z.coerce.string(),
  title: z.string(),
  ufCrm89Product: bitrixProductRef,
  ufCrm89Value: bitrixAmount,
  ufCrm89Interval: bitrixInterval,
  // Opcional na SPA: plano ainda não espelhado no gateway não tem id.
  // String vazia é normalizada para `undefined` — o domínio só conhece ausência.
  ufCrm89GatewayId: z
    .string()
    .nullish()
    .transform(value => value || undefined),
  ufCrm89Active: bitrixBoolean,
})

export const mapBitrixSpaPlanToRawPlan = (raw: unknown): RawPlan => {
  const parsed = bitrixPlanSchema.safeParse(raw)

  if (!parsed.success) {
    throw new InvalidBitrixPlanError(parsed.error.issues)
  }

  return {
    id: parsed.data.id,
    name: parsed.data.title,
    productId: parsed.data.ufCrm89Product,
    amount: parsed.data.ufCrm89Value,
    interval: parsed.data.ufCrm89Interval,
    gatewayId: parsed.data.ufCrm89GatewayId,
    active: parsed.data.ufCrm89Active,
  }
}

export const collectBitrixSpaPlanToRawPlan = (raw: unknown[]): RawPlan[] => {
  return raw.map(mapBitrixSpaPlanToRawPlan)
}
