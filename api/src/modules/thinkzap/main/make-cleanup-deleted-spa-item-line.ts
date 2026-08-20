import { CleanupDeletedSpaItemLine } from '@/modules/thinkzap/application/cleanup-deleted-spa-item-line'
import { ListOfferablePlans } from '@/modules/thinkzap/application/list-offerable-plans'
import {
  makePaymentGateway,
  makeSubscriptionDeps,
} from '@/modules/thinkzap/main/subscription/make-subscription-deps'

/**
 * Monta a limpeza do recurso de um item apagado na SPA 1146.
 *
 * Sem leitor de item, ao contrário das outras fábricas deste fluxo: o item não existe
 * mais, e a credencial vem do **espelho do recurso**. É a diferença que define este
 * caminho.
 *
 * Reusa `makeSubscriptionDeps` pela mesma razão do provisionamento: repositórios cacheados
 * sobre o portal interno, um resolver de provider compartilhado, e o
 * `ProviderResourceBilling` montado sobre ele. Fiação própria criaria um segundo cliente
 * HTTP para o mesmo provider e chaves de cache paralelas.
 *
 * O gateway entra como `makePaymentGateway()`, que devolve `null` sem chave configurada. O
 * caso de uso trata `null` como "cobrança não ajustada" e encerra com sucesso: o recurso
 * já foi desassinado, e retentar não configura ambiente.
 */
export const makeCleanupDeletedSpaItemLine = (): CleanupDeletedSpaItemLine => {
  const deps = makeSubscriptionDeps()

  return new CleanupDeletedSpaItemLine(
    deps.mirrors,
    deps.providerBilling,
    deps.providerResolver,
    deps.subscriptions,
    deps.getAplicationContext,
    new ListOfferablePlans(deps.plans),
    makePaymentGateway(),
  )
}
