import type { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import type {
  SendLineCatalog,
  SendLineInfo,
} from '@/modules/thinkzap/domain/ports/send-list-lookups.port'

/**
 * As linhas da instalação a partir do contexto de assinatura. Não chama Z-API
 * nem HubMessage: nome e id já estão nos itens. Linha cancelada continua na
 * lista porque o histórico de 90 dias ainda pode ter envios dela.
 */
export class ContextSendLineCatalog implements SendLineCatalog {
  constructor(private readonly getAplicationContext: GetAplicationContext) {}

  async listLines(input: {
    domainId: string
    appCode: string
  }): Promise<SendLineInfo[]> {
    const context = await this.getAplicationContext.execute(input)
    return context.subscriptions.flatMap(subscription =>
      subscription.items
        .filter(item => item.metadata.provider !== 'NONE')
        .map(item => ({ id: item.id, name: item.name })),
    )
  }
}
