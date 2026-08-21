import { env } from '@/config/env'
import type { StripeEnvironment } from '@/config/env'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import {
  SpaTextFieldIsEnumerationError,
  SpaTextFieldMissingError,
  ensureSpaTextField,
} from './ensure-spa-text-field'

/**
 * Os dois campos da SPA 1138 que guardam o price id do plano, **um por conta do
 * gateway**.
 *
 * Existem dois porque produção e homologação compartilham o mesmo portal Bitrix —
 * `CRMTHINK_WEBHOOK_URL` é o mesmo valor nos dois — e portanto a mesma SPA de
 * planos, enquanto usam contas Stripe distintas. Um campo só obrigaria a reescrever
 * o cadastro a cada troca de ambiente, e no intervalo um dos dois cobra com um price
 * id que a conta dele não conhece: o checkout falha **depois** de o cliente escolher
 * o plano.
 *
 * O nome de leitura não é escolha nossa. A API nova devolve o userfield em camelCase
 * derivado do `FIELD_NAME` da criação, e é por isso que o de produção se lê
 * `ufCrm89GatewayId` — ele foi criado como `UF_CRM_89_GATEWAY_ID`. Criar o de
 * homologação com qualquer outro sufixo produz outro nome de leitura, o mapper
 * resolve `undefined` para sempre, e o sintoma é idêntico ao campo vazio.
 *
 * Tem que ser texto e não lista pelo motivo registrado em `ensureSpaTextField`:
 * campo de lista devolve o id de enum gerado pelo portal, não o valor, e o price id
 * nunca chegaria à leitura.
 */
export const PLAN_GATEWAY_ID_FIELDS = {
  production: 'ufCrm89GatewayId',
  homolog: 'ufCrm89GatewayIdHomolog',
} as const satisfies Record<StripeEnvironment, string>

/** O `FIELD_NAME` que cada campo precisa ter na criação, para a mensagem de erro. */
const FIELD_NAMES: Record<StripeEnvironment, string> = {
  production: 'UF_CRM_89_GATEWAY_ID',
  homolog: 'UF_CRM_89_GATEWAY_ID_HOMOLOG',
}

/** O campo de price id que vale para o ambiente do gateway em uso. */
export function planGatewayIdField(
  environment: StripeEnvironment = env.payments.stripe.environment,
): (typeof PLAN_GATEWAY_ID_FIELDS)[StripeEnvironment] {
  return PLAN_GATEWAY_ID_FIELDS[environment]
}

/**
 * Mantidos como aliases dos erros compartilhados, como nos outros campos de SPA: o
 * tipo do erro faz parte do contrato de quem trata este caso.
 */
export {
  SpaTextFieldIsEnumerationError as PlanGatewayIdFieldIsEnumerationError,
  SpaTextFieldMissingError as PlanGatewayIdFieldMissingError,
}

/**
 * Garante que os **dois** campos de price id existem na SPA de planos.
 *
 * Verifica os dois, e não só o do ambiente em uso, de propósito: o campo do outro
 * ambiente é o que faz a leitura distinguir "plano de trial" de "plano pago
 * configurado só no outro lado" — sem ele, um plano pago sem price id aqui passa por
 * gratuito, porque `isTrialSubscription` deriva "é trial" justamente da ausência de
 * price id. A verificação de um campo que este ambiente não lê é o que impede uma
 * linha paga de ser liberada de graça no outro.
 *
 * Como o campo de provider, aqui é só **leitura** — o produto nunca escreve plano, e
 * nunca cria campo. A verificação existe porque sem ela o sintoma é "nenhum plano
 * disponível" na tela, que não aponta para um campo faltando no CRM.
 */
export async function ensurePlanGatewayIdFields(
  bitrix: BitrixClient,
  entityTypeId: number = env.payments.spa.planEntityType,
): Promise<void> {
  const environments: StripeEnvironment[] = ['production', 'homolog']

  for (const environment of environments) {
    await ensureSpaTextField({
      bitrix,
      entityTypeId,
      field: PLAN_GATEWAY_ID_FIELDS[environment],
      hint:
        `É o price id do gateway no ambiente "${environment}". Crie-o com FIELD_NAME ` +
        `exatamente "${FIELD_NAMES[environment]}" — o nome de leitura é derivado dele, ` +
        'e outro sufixo faz o plano ficar sem price id para sempre. Sem este campo ' +
        `nenhum plano é ofertável em ${environment}, e um plano pago sem price id no ` +
        'ambiente em uso é indistinguível do plano de trial, que é grátis.',
    })
  }
}
