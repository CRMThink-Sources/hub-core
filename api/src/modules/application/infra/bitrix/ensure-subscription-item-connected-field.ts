import { env } from '@/config/env'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { ensureSpaTextField } from './ensure-spa-text-field'

/**
 * Campo da SPA 1146 que espelha, para quem olha o CRM, se o WhatsApp da linha está
 * conectado (`UF_CRM_93_CONNECTED`, "Conectado").
 *
 * Campo de **texto** com `Sim` ou `Não` literais — o campo foi criado assim no
 * portal. É espelho de leitura: nenhuma regra do produto lê este campo, o estado
 * efetivo continua derivado ao vivo no provider.
 */
export const SUBSCRIPTION_ITEM_CONNECTED_FIELD = 'ufCrm93Connected' as const

/** A grafia gravada no campo. Um lugar só: o CRM filtra por este texto exato. */
export const CONNECTED_FIELD_VALUE = {
  yes: 'Sim',
  no: 'Não',
} as const

/** `true` depois da primeira verificação bem-sucedida — não repete a cada gravação. */
let checked = false

/**
 * Garante que o campo existe e é texto antes de qualquer gravação.
 *
 * `crm.item.update` aceita campo desconhecido e descarta o valor; sem esta checagem
 * um campo renomeado no CRM faria todo evento de conexão "gravar" no vazio.
 *
 * Memoizado por processo, como `ensureSubscriptionItemDeletionFields`: só o sucesso
 * é memoizado, para que um campo criado com o processo de pé seja reencontrado na
 * próxima tentativa.
 */
export async function ensureSubscriptionItemConnectedField(
  bitrix: BitrixClient,
  entityTypeId: number = env.payments.spa.subscriptionItemEntityType,
): Promise<void> {
  if (checked) return

  await ensureSpaTextField({
    bitrix,
    entityTypeId,
    field: SUBSCRIPTION_ITEM_CONNECTED_FIELD,
    hint:
      `Crie-o como texto e preencha "${CONNECTED_FIELD_VALUE.yes}" ou ` +
      `"${CONNECTED_FIELD_VALUE.no}" — é o campo que mostra no CRM se a linha está conectada.`,
  })

  checked = true
}
