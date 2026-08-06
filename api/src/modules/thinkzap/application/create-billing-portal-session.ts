import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { PaymentGateway } from '@/modules/thinkzap/domain/ports/payment-gateway.port'
import {
  isTrialSubscription,
  resolveCurrentSubscription,
} from '@/modules/thinkzap/domain/line-subscription'

export class BillingPortalNotAvailableError extends Error {
  constructor(reason: 'no-subscription' | 'not-gateway-modality') {
    super(
      reason === 'no-subscription'
        ? 'Esta instalação não tem assinatura: não há faturamento a gerenciar.'
        : 'A assinatura vigente não é do gateway de pagamento: não existe portal de faturamento para ela.',
    )
    this.name = 'BillingPortalNotAvailableError'
  }
}

/**
 * Abre o portal de faturamento do gateway para a assinatura vigente.
 *
 * **Recusa quando a assinatura não é do gateway.** Boleto é mantido por automação
 * fora do produto: não existe portal lá para ela, e tentar abrir daria erro na cara
 * do cliente. Trial também não tem — nunca houve cobrança.
 *
 * O id do cliente no gateway é resolvido **no servidor**, a partir da assinatura
 * da instalação do JWT. A tela nunca manda id de cliente: se mandasse, mandar o de
 * outra instalação abriria o portal alheio.
 */
export class CreateBillingPortalSession {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly gateway: PaymentGateway,
    private readonly returnUrl: string,
  ) {}

  async execute(input: {
    domainId: string
    appCode: string
  }): Promise<{ url: string }> {
    const context = await this.getAplicationContext.execute(input)

    const current = resolveCurrentSubscription(context.subscriptions)
    if (!current) {
      throw new BillingPortalNotAvailableError('no-subscription')
    }

    /**
     * As três condições juntas: modalidade do gateway, não trial, e com
     * `gatewayId` espelhado. A última é o caso da assinatura que o webhook criou
     * pela metade — sem o id não há o que abrir, e a mensagem certa é a mesma.
     */
    if (
      current.modality !== 'stripe' ||
      isTrialSubscription(current) ||
      !current.gatewayId
    ) {
      throw new BillingPortalNotAvailableError('not-gateway-modality')
    }

    return this.gateway.createBillingPortalSession({
      gatewaySubscriptionId: current.gatewayId,
      returnUrl: this.returnUrl,
    })
  }
}
