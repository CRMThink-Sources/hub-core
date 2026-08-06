import { env } from '@/config/env'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import {
  SpaTextFieldIsEnumerationError,
  SpaTextFieldMissingError,
  ensureSpaTextField,
} from './ensure-spa-text-field'

/**
 * Campo da SPA 1142 que guarda a modalidade de cobrança da assinatura.
 *
 * Tem que ser campo de **texto**, não de lista: campo de lista devolve o id de
 * enum gerado pelo portal (como `ufCrm91Status`), e o mapper — que lê valor
 * literal — resolveria `manual` para toda assinatura Stripe.
 */
export const SUBSCRIPTION_MODALITY_FIELD = 'ufCrm91Modality' as const

/**
 * Mantidos como aliases dos erros compartilhados: o tipo do erro faz parte do
 * contrato de quem já trata este caso, e a checagem em si é a mesma dos outros
 * campos de texto verificados.
 */
export {
  SpaTextFieldIsEnumerationError as SubscriptionModalityFieldIsEnumerationError,
  SpaTextFieldMissingError as SubscriptionModalityFieldMissingError,
}

/**
 * Garante que o campo de modalidade existe na SPA de assinaturas, e que ele é
 * legível pelo mapper, antes de qualquer escrita que dependa dele.
 *
 * **Por que isso é uma verificação e não uma suposição:** `crm.item.update`
 * aceita campo desconhecido e responde sucesso, descartando o valor — a mesma
 * armadilha de `ufCrm93Settings`. Sem esta checagem, um deploy com o campo
 * faltando gravaria a modalidade no vazio, toda assinatura leria `manual`, e o
 * cliente Stripe perderia o portal de faturamento. Sem erro, sem log, sem rastro.
 *
 * Chamada pela ativação, **antes** de criar a assinatura: configuração faltando
 * não pode deixar assinatura paga com a modalidade errada gravada.
 */
export async function ensureSubscriptionModalityField(
  bitrix: BitrixClient,
  entityTypeId: number = env.payments.spa.subscriptionEntityType,
): Promise<void> {
  await ensureSpaTextField({
    bitrix,
    entityTypeId,
    field: SUBSCRIPTION_MODALITY_FIELD,
    hint:
      'Use os valores "stripe" e "manual" — sem eles toda assinatura lê "manual" e ' +
      'o cliente do gateway perde o portal de faturamento.',
  })
}
