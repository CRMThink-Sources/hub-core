import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { resolveLineEntitlement } from '@/modules/thinkzap/domain/connector-trial'

/** O mínimo que a tela de configuração do robô de botão precisa por linha. */
export type ButtonLineOption = {
  /** Id do item de assinatura: é este valor que a propriedade `connector` guarda. */
  id: string
  name: string
}

export type ListButtonLinesInput = {
  domainId: string
  appCode: string
}

/**
 * As linhas da instalação **capazes de enviar botão pelo provider deste robô**,
 * para a tela do robô. Mirror de `ListTemplateLinesUseCase`, parametrizado pelo
 * provider — os dois robôs de botão só divergem nisso.
 *
 * Assinatura ativa é exigido nos dois; canal conectado (`wabaId`) só faz
 * sentido para `HUBMESSAGE` — Z-API não tem essa noção na listagem (o estado
 * de conexão ao vivo custaria uma chamada por linha, e quem confere isso é o
 * disparo em si).
 */
export class ListButtonLinesUseCase {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly provider: ConnectorProvider,
  ) {}

  async execute(input: ListButtonLinesInput): Promise<ButtonLineOption[]> {
    const context = await this.getAplicationContext.execute({
      domainId: input.domainId,
      appCode: input.appCode,
    })

    const now = new Date()

    return context.subscriptions.flatMap(subscription =>
      resolveLineEntitlement(subscription, now) === 'active'
        ? subscription.items
            .filter(item => this.isEligible(item))
            .map(item => ({ id: item.id, name: item.name }))
        : [],
    )
  }

  private isEligible(item: SubscriptionItem): boolean {
    if (item.metadata.provider !== (this.provider as string)) return false

    if (this.provider === ConnectorProvider.HUBMESSAGE) {
      return Boolean((item.metadata as { wabaId?: string | null }).wabaId)
    }

    return true
  }
}
