import { BitrixRawSubscriptionItemReader } from '@/modules/application/infra/bitrix/readers/bitrix-raw-subscription-item.reader'
import { SyncSpaItemResourceStatus } from '@/modules/thinkzap/application/sync-spa-item-resource-status'
import { makeSubscriptionDeps } from '@/modules/thinkzap/main/subscription/make-subscription-deps'

/**
 * Monta a sincronização entre o status do item na SPA 1146 e o ciclo de cobrança do
 * recurso no provider.
 *
 * Leitura **crua**, não pelo repositório de domínio: o mapper estrito recusa provider
 * declarado sem credencial, e esse item existe — é o criado à mão que ainda não foi
 * provisionado. Pelo repositório, o caso normal chegaria como
 * `InvalidBitrixSubscriptionItemError` e este fluxo teria que ler o estado do dado a
 * partir da mensagem de um erro de validação.
 *
 * A leitura crua também não passa por cache, e isso é o que se quer: o job decide a
 * partir do status **de agora**, e o evento que o disparou acabou de invalidar a entrada.
 *
 * Sem gateway na fiação, de propósito: o caminho de status não reconcilia cobrança do
 * contrato — o item continua existindo e continua contando como linha.
 */
export const makeSyncSpaItemResourceStatus = (): SyncSpaItemResourceStatus => {
  const deps = makeSubscriptionDeps()

  return new SyncSpaItemResourceStatus(
    new BitrixRawSubscriptionItemReader(deps.bitrixClient),
    deps.mirrors,
    deps.providerBilling,
  )
}
