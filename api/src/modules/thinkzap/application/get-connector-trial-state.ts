import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { PlanRepository } from '@/modules/application/domain/repositories/get-plan.repository'
import {
  TrialIneligibilityReason,
  checkTrialEligibility,
  isTrialStatus,
  resolveLineEntitlement,
} from '@/modules/thinkzap/domain/connector-trial'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { SpaClientContact } from '@/shared/domain/entities/spa-client-contact'
import { GetSpaClientContactRepository } from '@/shared/domain/repositories/spa/spa-client-contact.repository'
import { isTrialPlanAvailable } from './helpers/ensure-trial-plan'

/**
 * Estado do trial de uma instalação, para a tela decidir o que mostrar.
 *
 * `currentPeriodEnd` vai cru: fuso e formatação são responsabilidade da tela, que
 * já tem locale. Dias restantes calculados no servidor seriam um número errado
 * assim que o cliente virasse a meia-noite dele.
 */
export type ConnectorTrialState =
  /**
   * Pode ativar. `providers` é o que a tela oferece de escolha, e `contact` é o
   * que ela usa para pré-preencher o formulário.
   *
   * `contact` só existe aqui: é a única variante que rende formulário, e expor
   * contato nas outras seria superfície sem uso.
   */
  | {
      status: 'available'
      providers: ConnectorProvider[]
      contact: SpaClientContact
    }
  /** Trial em andamento. */
  | { status: 'active'; provider: ConnectorProvider; currentPeriodEnd: Date }
  /** Trial acabou. A linha continua visível, travada. */
  | { status: 'expired'; provider: ConnectorProvider; currentPeriodEnd: Date }
  /** Não pode ativar, e a razão distingue os casos para a mensagem. */
  | { status: 'unavailable'; reason: TrialIneligibilityReason }
  /**
   * Elegível, mas o plano de trial não está configurado na SPA.
   *
   * Estado próprio de propósito: sem ele a ativação falharia com erro de hidratação
   * de plano, e a tela mostraria "erro" para o que é configuração faltando.
   */
  | { status: 'misconfigured' }

const TRIAL_PROVIDERS: ConnectorProvider[] = [
  ConnectorProvider.ZAPI,
  ConnectorProvider.HUBMESSAGE,
]

export class GetConnectorTrialState {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly plans: PlanRepository,
    private readonly contacts: GetSpaClientContactRepository,
  ) {}

  async execute(
    input: { domainId: string; appCode: string },
    now: Date = new Date(),
  ): Promise<ConnectorTrialState> {
    const context = await this.getAplicationContext.execute(input)

    const eligibility = checkTrialEligibility(context)

    if (eligibility.eligible) {
      if (!(await isTrialPlanAvailable(this.plans))) {
        return { status: 'misconfigured' }
      }

      /**
       * A leitura do contato só acontece aqui: instalação já ativada — o caso
       * comum em regime — não paga a chamada extra ao CRM. `spaId` é garantido
       * pela elegibilidade, que barra `no-spa-mirror` antes.
       */
      return {
        status: 'available',
        providers: TRIAL_PROVIDERS,
        contact: await this.contacts.getContact(context.aplication.spaId!),
      }
    }

    /**
     * Não elegível por já ter usado: reporta o estado do trial em si, que é o que a
     * tela precisa para explicar. Qualquer outra razão é reportada crua.
     */
    if (eligibility.reason !== 'already-used') {
      return { status: 'unavailable', reason: eligibility.reason }
    }

    const trial = context.subscriptions.find(subscription =>
      isTrialStatus(subscription.status),
    )

    if (!trial) {
      // Inalcançável: `already-used` só sai quando toda assinatura é de teste, e
      // é o mesmo predicado que decide isso lá e acha o item aqui.
      return { status: 'unavailable', reason: 'already-used' }
    }

    const provider = this.providerOf(trial.items)
    const entitlement = resolveLineEntitlement(trial, now)

    return {
      status: entitlement === 'active' ? 'active' : 'expired',
      provider,
      currentPeriodEnd: trial.currentPeriodEnd,
    }
  }

  /** Provider do trial, lido da linha que ele provisionou. */
  private providerOf(
    items: Array<{ metadata: { provider: string } }>,
  ): ConnectorProvider {
    const hub = items.some(item => item.metadata.provider === 'HUBMESSAGE')
    return hub ? ConnectorProvider.HUBMESSAGE : ConnectorProvider.ZAPI
  }
}
