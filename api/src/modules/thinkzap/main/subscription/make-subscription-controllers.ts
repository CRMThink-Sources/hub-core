import { env } from '@/config/env'
import { Controller } from '@/shared/presentation/controller'
import { GetLineSubscriptionState } from '@/modules/thinkzap/application/get-line-subscription-state'
import { GetSubscriptionStateController } from '@/modules/thinkzap/presentation/controllers/subscription/get-subscription-state.controller'
import { StripeWebhookController } from '@/modules/thinkzap/presentation/controllers/subscription/stripe-webhook.controller'
import { ListPlansController } from '@/modules/thinkzap/presentation/controllers/subscription/list-plans.controller'
import { CreateCheckoutController } from '@/modules/thinkzap/presentation/controllers/subscription/create-checkout.controller'
import { CreateBillingPortalController } from '@/modules/thinkzap/presentation/controllers/subscription/create-billing-portal.controller'
import { ActivateLineSubscription } from '@/modules/thinkzap/application/activate-line-subscription'
import { HandleGatewayWebhookEvent } from '@/modules/thinkzap/application/handle-gateway-webhook-event'
import { ListOfferablePlans } from '@/modules/thinkzap/application/list-offerable-plans'
import { CreateSubscriptionCheckout } from '@/modules/thinkzap/application/create-subscription-checkout'
import { CreateAdditionalLine } from '@/modules/thinkzap/application/create-additional-line'
import { CreateLineController } from '@/modules/thinkzap/presentation/controllers/line/create-line.controller'
import { CreateBillingPortalSession } from '@/modules/thinkzap/application/create-billing-portal-session'
import {
  GatewaySignatureError,
  PaymentGateway,
} from '@/modules/thinkzap/domain/ports/payment-gateway.port'
import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { requireAbsoluteUrl } from '@/shared/main/require-absolute-url'
import {
  makePaymentGateway,
  makeSubscriptionDeps,
} from './make-subscription-deps'
import { thinkzapError } from '../../errors/catalog'

export const makeGetSubscriptionStateController = (): Controller => {
  /**
   * Só o contexto: a rota é de leitura, e o estado que ela devolve sai todo da
   * SPA. Nenhum cliente de gateway é montado aqui — o runtime nunca consulta o
   * gateway, e a fiação é onde essa regra fica visível.
   */
  return new GetSubscriptionStateController(
    new GetLineSubscriptionState(makeGetAplicationContext()),
  )
}

export const makeListPlansController = (): Controller => {
  /**
   * Só o catálogo: a listagem deixou de ser filtrada pela instalação quando
   * providers misturados passaram a ser precificáveis, então o contexto não
   * participa mais da resposta.
   */
  const { plans } = makeSubscriptionDeps()

  return new ListPlansController(new ListOfferablePlans(plans))
}

/**
 * Erro na fiação quando o gateway não está configurado.
 *
 * As rotas de contratação **existem** para depender dele: sem chave não há
 * checkout nem portal, e responder `500` com a causa nomeada é mais honesto que
 * um `200` com URL vazia. A modalidade boleto não passa por aqui e continua
 * inteira.
 */
function requireGateway(): PaymentGateway {
  const gateway = makePaymentGateway()

  if (!gateway) {
    throw thinkzapError('thinkzap.gateway.not_configured')
  }

  return gateway
}

/**
 * Base absoluta do front, validada.
 *
 * O gateway exige URL absoluta em `success_url`/`cancel_url`. Com `FRONT_URL`
 * ausente, `env.frontUrl` cai em string vazia e a URL montada fica relativa
 * (`/thinkzap/conexoes?...`) — o Stripe recusa com `Not a valid URL`, longe da
 * causa, depois de já ter ido à rede.
 *
 * Valida aqui para a mensagem nomear a variável, e **antes** de qualquer chamada ao
 * gateway. Mesma postura de `requireGateway`.
 *
 * A barra final é removida: `FRONT_URL=http://host/` produziria `//thinkzap`, que
 * o navegador resolve como outro host.
 */
function requireFrontUrl(): string {
  /**
   * Nomeia as duas: `env.frontUrl` cai em `APP_URL`, então falhar aqui significa que
   * nenhuma das duas está definida — apontar só `FRONT_URL` mandaria configurar a
   * variável menos provável.
   */
  return requireAbsoluteUrl(env.frontUrl, 'FRONT_URL (ou APP_URL)')
}

export const makeCreateCheckoutController = (): Controller => {
  const { getAplicationContext, plans, bitrixClient } = makeSubscriptionDeps()

  /**
   * Sem URL de retorno: o checkout é embedado com redirecionamento desligado, então
   * `FRONT_URL` não participa deste caminho. Quem ainda precisa dela é o portal de
   * faturamento, que é página hospedada.
   */
  return new CreateCheckoutController(
    new CreateSubscriptionCheckout(
      getAplicationContext,
      new ListOfferablePlans(plans),
      requireGateway(),
      bitrixClient,
    ),
  )
}

export const makeCreateBillingPortalController = (): Controller => {
  const { getAplicationContext } = makeSubscriptionDeps()

  return new CreateBillingPortalController(
    new CreateBillingPortalSession(
      getAplicationContext,
      requireGateway(),
      // Mesma validação do checkout: o `return_url` do portal também é absoluto.
      `${requireFrontUrl()}/thinkzap/conexoes`,
    ),
  )
}

export const makeStripeWebhookController = (): Controller => {
  const gateway = makePaymentGateway()

  /**
   * Gateway não configurado: o endpoint recusa todo evento, pelo mesmo caminho de
   * assinatura inválida. É a resposta honesta — sem segredo não há como
   * autenticar a origem, e aceitar destravaria linha por um POST forjado.
   */
  if (!gateway) {
    return new StripeWebhookController(
      {
        verifyWebhookEvent: () =>
          Promise.reject(
            new GatewaySignatureError('gateway de pagamento não configurado'),
          ),
        createCheckoutSession: () =>
          Promise.reject(new Error('gateway de pagamento não configurado')),
        syncSubscriptionLineItems: () =>
          Promise.reject(new Error('gateway de pagamento não configurado')),
        createBillingPortalSession: () =>
          Promise.reject(new Error('gateway de pagamento não configurado')),
      },
      // Inalcançável: a validação acima recusa antes de chegar ao handler.
      null as unknown as HandleGatewayWebhookEvent,
    )
  }

  const {
    bitrixClient,
    getAplicationContext,
    subscriptions,
    items,
    providerBilling,
    plans,
    providerResolver,
  } = makeSubscriptionDeps()

  return new StripeWebhookController(
    gateway,
    new HandleGatewayWebhookEvent(
      new ActivateLineSubscription(
        getAplicationContext,
        subscriptions,
        items,
        providerBilling,
        bitrixClient,
        /**
         * O catálogo ofertável entra na ativação porque ela resolve o plano de cada
         * conector: uma contratação pode cobrir linhas de dois conectores, e cada
         * grupo nasce sob o plano que o precifica.
         */
        new ListOfferablePlans(plans),
        /**
         * O resolver de provider entra porque a ativação pode **criar** linha, quando
         * a contratação veio de uma criação: aí o recurso é provisionado aqui, depois
         * de o pagamento ser confirmado.
         */
        providerResolver,
      ),
      subscriptions,
      items,
      providerBilling,
    ),
  )
}

export const makeCreateLineController = (): Controller => {
  const {
    getAplicationContext,
    plans,
    subscriptions,
    items,
    providerBilling,
    providerResolver,
  } = makeSubscriptionDeps()

  return new CreateLineController(
    new CreateAdditionalLine(
      getAplicationContext,
      new ListOfferablePlans(plans),
      requireGateway(),
      subscriptions,
      items,
      providerResolver,
      providerBilling,
    ),
  )
}
