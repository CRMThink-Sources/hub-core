import { env } from '@/config/env'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { ensureSpaTextField } from './ensure-spa-text-field'

/**
 * Campo da SPA 1138 que diz **qual conector** o plano precifica.
 *
 * Existe porque conector oficial e não oficial custam diferente, e sem este campo
 * nada amarra o plano escolhido ao provider da linha: um cliente com linha Z-API
 * poderia contratar o plano do Oficial (ou o contrário), pagando menos do que
 * consome — silenciosamente, em todas as camadas.
 *
 * Campo de **texto** com `ZAPI` ou `HUBMESSAGE`, o mesmo vocabulário de
 * `SubscriptionItemMetadata.provider`. Vazio é o plano de trial, que não precifica
 * conector nenhum.
 */
export const PLAN_PROVIDER_FIELD = 'ufCrm89Provider' as const

/**
 * Garante que o campo de provider existe na SPA de planos.
 *
 * Diferente da modalidade, aqui o campo é só **lido** — o produto nunca escreve
 * plano. A verificação continua valendo por outro motivo: sem o campo, todo plano
 * pago resolve provider `undefined` e deixa de ser ofertável, e a tela mostraria
 * "nenhum plano disponível" sem dizer por quê.
 */
export async function ensurePlanProviderField(
  bitrix: BitrixClient,
  entityTypeId: number = env.payments.spa.planEntityType,
): Promise<void> {
  await ensureSpaTextField({
    bitrix,
    entityTypeId,
    field: PLAN_PROVIDER_FIELD,
    hint:
      'Use "ZAPI" ou "HUBMESSAGE" nos planos pagos, e deixe vazio no plano de trial. ' +
      'Sem o campo nenhum plano pago é ofertável no checkout.',
  })
}
