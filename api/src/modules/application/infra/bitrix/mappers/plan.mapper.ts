import z from 'zod'
import { Plan, PlanProvider } from '@/modules/application/domain/entities/plan'
import { env } from '@/config/env'
import { apiLogger } from '@/shared/infra/logger'
import {
  PLAN_GATEWAY_ID_FIELDS,
  planGatewayIdField,
} from '../ensure-plan-gateway-id-fields'
import { PLAN_PROVIDER_FIELD } from '../ensure-plan-provider-field'
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

const PLAN_PROVIDERS: readonly PlanProvider[] = ['ZAPI', 'HUBMESSAGE']

/**
 * Provider da SPA → domínio, **tolerante mas fechado**.
 *
 * Ausente, vazio e valor desconhecido resolvem `undefined`, e não reprovam o
 * plano: reprovar derrubaria `getPlan`, que hidrata `Subscription.plan` — e uma
 * assinatura apontando para plano inválido derruba a leitura do contexto inteiro
 * da instalação, incluindo a lista de linhas.
 *
 * `undefined` num plano pago o torna **não ofertável** (ver `Plan.provider`), então
 * a tolerância aqui não abre a porta que o campo veio fechar: ela só troca "a tela
 * quebra" por "o plano não aparece". Valor desconhecido é `warn`, porque aí alguém
 * digitou algo no CRM e o sintoma — plano sumido do checkout — não aponta para a
 * causa.
 */
const bitrixPlanProvider = z
  .unknown()
  .transform((raw): PlanProvider | undefined => {
    if (raw === undefined || raw === null || raw === '') return undefined

    const value =
      typeof raw === 'string' || typeof raw === 'number'
        ? String(raw).trim().toUpperCase()
        : JSON.stringify(raw)

    if ((PLAN_PROVIDERS as readonly string[]).includes(value)) {
      return value as PlanProvider
    }

    apiLogger.warn(
      { app: 'shared', field: PLAN_PROVIDER_FIELD, value },
      'Provider de plano desconhecido — o plano não será ofertável no checkout',
    )

    return undefined
  })

/**
 * Price id como a SPA guarda: opcional, porque um plano existe no catálogo antes de
 * ser espelhado em qualquer gateway. `null` e string vazia viram `undefined` — o
 * domínio só conhece ausência, nunca `''`.
 */
const bitrixGatewayId = z
  .string()
  .nullish()
  .transform(value => value || undefined)

/**
 * O price id do **ambiente em uso**, e o aviso quando ele falta mas o do outro
 * ambiente está lá.
 *
 * O aviso é a única coisa que separa dois estados que produzem o mesmo
 * `gatewayId: undefined`:
 *
 * | ambiente em uso | outro ambiente | o que é           |
 * |-----------------|----------------|-------------------|
 * | vazio           | vazio          | plano de trial    |
 * | vazio           | preenchido     | plano mal cadastrado aqui |
 *
 * A distinção importa porque `isTrialSubscription` deriva "é trial" de **não ter**
 * price id: sem o aviso, um plano pago configurado só em produção passa por gratuito
 * em homologação, e a linha é liberada sem cobrança.
 *
 * **Não reprova o plano**, mesma postura do provider desconhecido: `getPlan` hidrata
 * `Subscription.plan`, e lançar aqui derrubaria a leitura do contexto inteiro da
 * instalação. O plano fica sem price id, logo não ofertável — falha fechada — e o log
 * nomeia o campo vazio.
 *
 * **Sem fallback entre ambientes**, nos dois sentidos: usar o price id do outro lado
 * seria mandar para a conta do gateway um id que ela não conhece, ou cobrar um
 * cliente de produção com o preço de teste.
 */
function resolveGatewayIdForEnvironment(input: {
  planId: string
  name: string
  production: string | undefined
  homolog: string | undefined
}): string | undefined {
  const environment = env.payments.stripe.environment
  const current =
    environment === 'production' ? input.production : input.homolog
  const other = environment === 'production' ? input.homolog : input.production

  if (current) return current

  if (other) {
    apiLogger.warn(
      {
        app: 'payments',
        planId: input.planId,
        plan: input.name,
        field: planGatewayIdField(environment),
        environment,
      },
      'Plano tem price id só no outro ambiente do gateway — não será ofertável, e ' +
        'não é um plano de trial',
    )
  }

  return undefined
}

const bitrixPlanSchema = z.object({
  id: z.coerce.string(),
  title: z.string(),
  ufCrm89Product: bitrixProductRef,
  ufCrm89Value: bitrixAmount,
  ufCrm89Interval: bitrixInterval,
  /**
   * Os dois price ids, um por conta do gateway. Os dois opcionais, e qual deles vira
   * `Plan.gatewayId` é decidido por `resolveGatewayIdForEnvironment` — o domínio
   * nunca vê os dois valores, senão cada consumidor de price id passaria a escolher
   * ambiente, e a primeira escolha errada é uma cobrança na conta errada.
   *
   * Sem `.optional()` no campo de homologação: chave ausente já chega como
   * `undefined` e o `nullish` trata — é o caso de todo plano anterior ao campo.
   */
  [PLAN_GATEWAY_ID_FIELDS.production]: bitrixGatewayId,
  [PLAN_GATEWAY_ID_FIELDS.homolog]: bitrixGatewayId,
  ufCrm89Active: bitrixBoolean,
  /**
   * Sem `.optional()` no `z.unknown()`: chave ausente já chega como `undefined`, e o
   * transform trata — é o caso de todo plano anterior a este campo.
   */
  [PLAN_PROVIDER_FIELD]: bitrixPlanProvider,
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
    gatewayId: resolveGatewayIdForEnvironment({
      planId: parsed.data.id,
      name: parsed.data.title,
      production: parsed.data[PLAN_GATEWAY_ID_FIELDS.production],
      homolog: parsed.data[PLAN_GATEWAY_ID_FIELDS.homolog],
    }),
    provider: parsed.data[PLAN_PROVIDER_FIELD],
    active: parsed.data.ufCrm89Active,
  }
}

/**
 * Na listagem, plano mal cadastrado (ex.: intervalo vazio) é **descartado**, não
 * propagado: um registro ruim na SPA não pode derrubar o catálogo inteiro. É falha
 * fechada — o plano só some da oferta — e o `warn` nomeia o registro e os campos
 * para alguém corrigir no CRM.
 *
 * `mapBitrixSpaPlanToRawPlan` continua lançando: quem pede um plano específico
 * precisa saber que ele é inválido.
 */
export const collectBitrixSpaPlanToRawPlan = (raw: unknown[]): RawPlan[] => {
  return raw.flatMap(item => {
    try {
      return [mapBitrixSpaPlanToRawPlan(item)]
    } catch (error) {
      if (!(error instanceof InvalidBitrixPlanError)) throw error

      apiLogger.warn(
        {
          app: 'payments',
          planId: (item as { id?: unknown } | null)?.id,
          fields: error.issues.map(issue => issue.path.join('.')),
        },
        'Plano inválido na SPA ignorado na listagem',
      )

      return []
    }
  })
}
