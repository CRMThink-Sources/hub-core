import { randomUUID } from 'node:crypto'
import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { SubscriptionItemRepository } from '@/modules/application/domain/repositories/subscription-item.repository'
import { apiLogger } from '@/shared/infra/logger'
import { GetAllowedUserRepository } from '@/modules/thinkzap/domain/repositories/allowed-user/get-allowed-user.repository'
import { GetBitrixUserDisplayNamePort } from '@/modules/thinkzap/domain/ports/get-bitrix-user-display-name.port'
import { findItemInContext } from './helpers/resolve-line-by-subscription-item'
import { resolveBitrixUserDisplayName } from './resolve-bitrix-user-display-name'

/**
 * Enfileira a limpeza do recurso — mesmo shape de `enqueueSpaItemCleanupJob`, como
 * tipo local e não importado da fila. `delete-line.ts` é importado por teste de
 * controller, e a fila real (`@/queue/spa-item-resource-sync.queue`) importa
 * `redisConnection`, que conecta ao Redis **na importação do módulo** — um efeito
 * colateral que um teste unitário não deve pagar só por importar este arquivo. A
 * função de verdade entra só na composição (`make-line-controllers.ts`), nunca
 * como valor default aqui.
 */
export type EnqueueDeleteLineCleanup = (job: {
  itemId: string
  traceKey: string
  deletedBy: string
  deletedAt: string
  /**
   * `app`: a limpeza é do próprio ambiente, sobre um recurso dele — roda mesmo onde os
   * efeitos de provider do webhook da SPA estão desligados.
   */
  source: 'app'
}) => Promise<unknown>

export type DeleteLineInput = {
  subscriptionItemId: string
  /** Uuid de `core_domains`, como vem no JWT. */
  domainId: string
  /** `core_app_codes.id`, como vem no JWT. */
  appCode: string
  /** Id do usuário Bitrix autenticado, como vem no JWT — quem está excluindo. */
  bitrixUserId: string
}

/**
 * Exclui a linha da instalação — **editando** o item, não apagando.
 *
 * **Excluir virou editar.** Até `connector-soft-delete`, isto apagava o item
 * (`crm.item.delete`) e a limpeza do recurso vinha do webhook de saída que o item
 * apagado disparava. Apagar também apagava o histórico do item — inclusive quem e
 * quando excluiu. Agora o item permanece na SPA: `status` vira `cancelled`, e
 * `deletedAt`/`deletedBy` registram quando e por quem.
 *
 * **A limpeza do recurso continua com o mesmo resultado de antes** — desassinar no
 * provider, desconectar a sessão, reconciliar a cobrança e encerrar o contrato na
 * última linha —, só que enfileirada **diretamente daqui** (`enqueueSpaItemCleanupJob`,
 * mesmo `jobId` determinístico e mesmo retry do caminho antigo), porque o item
 * deixa de ser apagado e o webhook reativo não dispara mais para este caminho.
 *
 * **A autorização sai de graça.** `GetAplicationContext` resolve a instalação pelo
 * par (`domainId`, `appCode`) do JWT e só devolve as assinaturas dela, então o id de
 * um item de outro cliente não está na árvore. `findItemInContext` lança
 * `LineNotFoundError`, que a apresentação traduz para `404` — indistinguível de
 * inexistente de propósito, para não confirmar a existência de recurso alheio.
 *
 * **Não checa habilitação.** Linha de trial vencido, bloqueada ou inadimplente pode
 * ser excluída: recusar prenderia o cliente a uma linha que ele não usa mais e ainda
 * pode estar pagando. `assertLineEnabled` guarda escrita **na** linha, e excluir não
 * é escrever nela.
 *
 * Não checa se é a última linha do contrato. Essa decisão é do contrato, e mora na
 * limpeza — ver `CleanupDeletedSpaItemLine`.
 */
export class DeleteLine {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly items: SubscriptionItemRepository,
    /**
     * Resolve o nome de exibição de quem excluiu, contra o Bitrix **do portal do
     * cliente** — diferente do `BitrixClient` interno que `items` usa para
     * escrever na SPA. Quem monta este caso de uso resolve o cliente certo a
     * partir do `req` (`makeBitrixClient`), porque a credencial só é conhecida na
     * borda da requisição.
     */
    private readonly getBitrixUserDisplayName: GetBitrixUserDisplayNamePort,
    private readonly getAllowedUser: GetAllowedUserRepository,
    /**
     * Confere que `UF_CRM_93_DELETED_AT`/`UF_CRM_93_DELETED_BY` existem na SPA
     * antes de qualquer escrita. Injetado como função — e não como dependência de
     * `items` — porque o guard fala com o Bitrix **interno** direto (o mesmo
     * portal que `makeSubscriptionItemRepository` usa), sem passar pela
     * abstração de repositório. Sem default: quem monta este caso de uso
     * (`make-line-controllers.ts`) decide o `BitrixClient`, e o teste dubla sem
     * precisar de um real.
     */
    private readonly ensureDeletionFieldsExist: () => Promise<void>,
    /** Ver `EnqueueDeleteLineCleanup`. Sem default, pelo mesmo motivo. */
    private readonly enqueueCleanup: EnqueueDeleteLineCleanup,
  ) {}

  async execute(input: DeleteLineInput): Promise<void> {
    await this.ensureDeletionFieldsExist()

    const context = await this.getAplicationContext.execute({
      domainId: input.domainId,
      appCode: input.appCode,
    })

    const item = findItemInContext(context, input.subscriptionItemId)

    const nameResolution = await resolveBitrixUserDisplayName({
      userId: input.bitrixUserId,
      appId: context.aplication.id,
      getBitrixUserDisplayName: this.getBitrixUserDisplayName,
      getAllowedUser: this.getAllowedUser,
    })

    /**
     * Nome imperfeito (o próprio id bruto) em vez de falhar a exclusão por não
     * achar um nome — a exclusão é real, e travá-la por causa de um campo de
     * auditoria trocaria um dano pequeno (nome feio no CRM) por um maior
     * (cliente não consegue excluir a linha).
     */
    const deletedBy = nameResolution.name ?? input.bitrixUserId
    const deletedAt = new Date()

    await this.items.updateSubscriptionItem(item.id, {
      status: 'cancelled',
      deletedAt,
      deletedBy,
    })

    /**
     * Registrado **antes** do enqueue, com tudo que identifica a ação: se o
     * enqueue falhar logo abaixo, esta linha ainda prova que a exclusão
     * aconteceu e quem a fez — diferente de apagar pelo Bitrix, aqui a aplicação
     * sabe que excluiu, e este log é a prova disso.
     */
    apiLogger.info(
      {
        app: 'payments',
        subscriptionItemId: item.id,
        subscriptionId: item.subscription,
        provider: item.metadata.provider,
        domainId: input.domainId,
        bitrixUserId: input.bitrixUserId,
        deletedBy,
        deletedAt: deletedAt.toISOString(),
        ...(nameResolution.failure && {
          nameResolutionFailure: nameResolution.failure,
        }),
      },
      'Linha excluída pelo cliente — item editado para cancelado, limpeza do recurso enfileirada a seguir',
    )

    await this.enqueueCleanup({
      itemId: item.id,
      traceKey: randomUUID(),
      deletedBy,
      deletedAt: deletedAt.toISOString(),
      source: 'app',
    })
  }
}
