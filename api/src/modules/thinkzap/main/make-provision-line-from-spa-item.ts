import { BitrixRawSubscriptionItemReader } from '@/modules/application/infra/bitrix/readers/bitrix-raw-subscription-item.reader'
import { ListOfferablePlans } from '@/modules/thinkzap/application/list-offerable-plans'
import { ProvisionLineFromSpaItem } from '@/modules/thinkzap/application/provision-line-from-spa-item'
import {
  makePaymentGateway,
  makeSubscriptionDeps,
} from '@/modules/thinkzap/main/subscription/make-subscription-deps'

/**
 * Monta o provisionamento de linha criada à mão na SPA 1146.
 *
 * Reusa `makeSubscriptionDeps`, que é a mesma fiação da criação de linha pelo produto:
 * repositórios **cacheados** sobre o portal interno da CRMThink, um resolver de provider
 * compartilhado, e o `ProviderResourceBilling` montado sobre ele. Uma fiação própria aqui
 * criaria um segundo cliente HTTP para o mesmo provider e chaves de cache paralelas — a
 * escrita deste fluxo deixaria de invalidar o que o contexto lê.
 *
 * O gateway entra como `makePaymentGateway()`, que devolve `null` sem chave configurada.
 * O caso de uso trata `null` como "cobrança não ajustada", não como boot quebrado:
 * provisionar não depende do gateway, e uma instalação inteira pode viver no boleto.
 */
export const makeProvisionLineFromSpaItem = (): ProvisionLineFromSpaItem => {
  const deps = makeSubscriptionDeps()

  return new ProvisionLineFromSpaItem(
    new BitrixRawSubscriptionItemReader(deps.bitrixClient),
    deps.subscriptions,
    deps.items,
    deps.getAplicationContext,
    new ListOfferablePlans(deps.plans),
    makePaymentGateway(),
    deps.providerResolver,
    deps.providerBilling,
  )
}
