import type { SubscriptionItemRepository } from '@/modules/application/domain/repositories/subscription-item.repository'

export type SyncLineConnectedFieldInput = {
  itemId: string
  /** Valor lido no item antes da escrita; `null` = nunca registrado. */
  current: boolean | null
  connected: boolean
}

export type SyncLineConnectedFieldOutcome = 'written' | 'unchanged'

/**
 * Grava `Sim`/`Não` em `UF_CRM_93_CONNECTED` do item da linha, **só quando muda**.
 *
 * A comparação é o que segura o tráfego: toda escrita no item dispara
 * `ONCRMDYNAMICITEMUPDATE` e um job de sincronização de status, e reentrega de
 * webhook ou reconexão sem mudança não pode virar escrita.
 *
 * Escreve pelo repositório com cache, nunca pelo client cru — senão o contexto em
 * cache continuaria servindo o valor anterior até o TTL.
 */
export class SyncLineConnectedField {
  constructor(
    private readonly items: Pick<
      SubscriptionItemRepository,
      'updateSubscriptionItem'
    >,
    /** Ver `ensureSubscriptionItemConnectedField`. Injetado pelo mesmo motivo de `DeleteLine`. */
    private readonly ensureConnectedFieldExists: () => Promise<void>,
  ) {}

  async execute(
    input: SyncLineConnectedFieldInput,
  ): Promise<SyncLineConnectedFieldOutcome> {
    if (input.current === input.connected) return 'unchanged'

    await this.ensureConnectedFieldExists()
    await this.items.updateSubscriptionItem(input.itemId, {
      connected: input.connected,
    })

    return 'written'
  }
}
