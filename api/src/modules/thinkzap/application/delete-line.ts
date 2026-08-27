import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { SubscriptionItemRepository } from '@/modules/application/domain/repositories/subscription-item.repository'
import { apiLogger } from '@/shared/infra/logger'
import { findItemInContext } from './helpers/resolve-line-by-subscription-item'

export type DeleteLineInput = {
  subscriptionItemId: string
  /** Uuid de `core_domains`, como vem no JWT. */
  domainId: string
  /** `core_app_codes.id`, como vem no JWT. */
  appCode: string
}

/**
 * Apaga a linha da instalação.
 *
 * **Apaga o item, e para por aí.** Desassinar o recurso no provider, desconectar a
 * sessão e ajustar a cobrança são feitos pelo webhook de saída da SPA que o item
 * apagado dispara — o mesmo caminho de quando alguém apaga pelo Bitrix. Uma segunda
 * implementação aqui divergiria da primeira, e o sintoma seria recurso pago no
 * provider que ninguém desassinou.
 *
 * **A autorização sai de graça.** `GetAplicationContext` resolve a instalação pelo
 * par (`domainId`, `appCode`) do JWT e só devolve as assinaturas dela, então o id de
 * um item de outro cliente não está na árvore. `findItemInContext` lança
 * `LineNotFoundError`, que a apresentação traduz para `404` — indistinguível de
 * inexistente de propósito, para não confirmar a existência de recurso alheio.
 *
 * **Não checa habilitação.** Linha de trial vencido, bloqueada ou inadimplente pode
 * ser excluída: recusar prenderia o cliente a uma linha que ele não usa mais e ainda
 * pode estar pagando. `assertLineEnabled` guarda escrita **na** linha, e apagar não é
 * escrever nela.
 *
 * Não checa se é a última linha do contrato. Essa decisão é do contrato, e mora na
 * limpeza — ver `CleanupDeletedSpaItemLine`.
 */
export class DeleteLine {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly items: SubscriptionItemRepository,
  ) {}

  async execute(input: DeleteLineInput): Promise<void> {
    const context = await this.getAplicationContext.execute({
      domainId: input.domainId,
      appCode: input.appCode,
    })

    const item = findItemInContext(context, input.subscriptionItemId)

    await this.items.deleteSubscriptionItem(item.id)

    /**
     * Registrado **depois** da escrita, e com o id da assinatura pai.
     *
     * É o que torna o órfão rastreável quando a limpeza não acontece — webhook de
     * saída não registrado, fila parada. Diferente de apagar pelo Bitrix, aqui a
     * aplicação sabe que apagou, e esta linha de log é a única prova disso.
     */
    apiLogger.info(
      {
        app: 'payments',
        subscriptionItemId: item.id,
        subscriptionId: item.subscription,
        provider: item.metadata.provider,
      },
      'Linha apagada pelo cliente — limpeza do recurso segue pelo webhook da SPA',
    )
  }
}
