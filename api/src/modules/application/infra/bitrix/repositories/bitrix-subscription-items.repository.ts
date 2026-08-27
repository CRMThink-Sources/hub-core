import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { BitrixError } from '@/shared/infra/clients/errors/bitrix-client.error'
import {
  CreateSubscriptionItemInput,
  SubscriptionItemRepository,
  UpdateSubscriptionItemInput,
} from '@/modules/application/domain/repositories/subscription-item.repository'
import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { SubscriptionItemNotFoundError } from '@/modules/application/domain/errors/subscription-item-not-found.error'
import { SubscriptionNotFoundError } from '@/modules/application/domain/errors/subscription-not-found.error'
import { env } from '@/config/env'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import {
  SUBSCRIPTION_PARENT_FIELD,
  collectBitrixSpaSubscriptionItemToSubscriptionItem,
  mapBitrixSpaSubscriptionItemToSubscriptionItem,
  mapSubscriptionItemInputToBitrixFields,
} from '../mappers/subscription-item.mapper'

/**
 * Só o `BitrixClient` no construtor: diferente de plano e assinatura, o item não
 * hidrata nenhuma outra entidade — `subscription` fica sendo o id do pai — então
 * não há repositório a injetar.
 */
export class BitrixSubscriptionItemRepository implements SubscriptionItemRepository {
  constructor(private readonly bitrix: BitrixClient) {}

  async getSubscriptionItem(id: string): Promise<SubscriptionItem> {
    const response = await this.bitrix.getCrmItem(
      env.payments.spa.subscriptionItemEntityType,
      id,
    )

    const item = response.result?.item
    if (!item) throw new SubscriptionItemNotFoundError(id)

    return mapBitrixSpaSubscriptionItemToSubscriptionItem(item)
  }

  async getSubscriptionItems(): Promise<SubscriptionItem[]> {
    return this.list({})
  }

  async getSubscriptionItemsBySubscription(
    subscriptionId: string,
  ): Promise<SubscriptionItem[]> {
    return this.list({ [SUBSCRIPTION_PARENT_FIELD]: subscriptionId })
  }

  async createSubscriptionItem(
    input: CreateSubscriptionItemInput,
  ): Promise<SubscriptionItem> {
    /**
     * Item nasce com os quatro toggles explícitos no campo. O default é resolvido
     * aqui, e não no mapper, porque o mapper serve criação e patch com a mesma
     * função e não sabe distinguir "não informado numa criação" (vira default) de
     * "não informado num patch" (não toca no campo).
     */
    const response = await this.bitrix.createCrmItem(
      env.payments.spa.subscriptionItemEntityType,
      mapSubscriptionItemInputToBitrixFields({
        ...input,
        settings: input.settings ?? { ...DEFAULT_CONNECTOR_SETTINGS },
      }),
    )

    const id = response.result?.item?.id
    if (!id) {
      throw new BitrixError(
        'crm.item.add não devolveu o id do item de assinatura criado',
      )
    }

    // Releitura de propósito: passa pelo mesmo mapper que a leitura, então
    // criação e leitura nunca divergem de shape.
    return this.getSubscriptionItem(String(id))
  }

  async updateSubscriptionItem(
    id: string,
    patch: UpdateSubscriptionItemInput,
  ): Promise<SubscriptionItem> {
    const fields = mapSubscriptionItemInputToBitrixFields(patch)

    /**
     * O tipo do patch já omite `subscription`, e o mapper só emite o parent
     * quando a chave está presente — que é o caminho de criação. Isto torna a
     * regra verdadeira também em runtime, para o caso de a chave chegar por um
     * cast ou por objeto montado dinamicamente: mover item é
     * `reparentSubscriptionItem`, e essa é a **única** porta.
     */
    delete fields[SUBSCRIPTION_PARENT_FIELD]

    await this.bitrix.updateCrmItem(
      env.payments.spa.subscriptionItemEntityType,
      id,
      fields,
    )

    return this.getSubscriptionItem(id)
  }

  async reparentSubscriptionItem(
    itemId: string,
    subscriptionId: string,
  ): Promise<SubscriptionItem> {
    /**
     * **Antes** da escrita: parent apontando para assinatura inexistente deixaria
     * o item fora da árvore de cobrança, e `resolveLineEntitlement` não acharia
     * pai nenhum — a linha morreria sem que nada tivesse falhado.
     *
     * Verificado por `crm.item.get` cru, não pelo `SubscriptionRepository`: a
     * pergunta é só "existe", e a hidratação do repositório lança por plano ou
     * instalação ausente, o que faria uma inconsistência sem relação com o repai
     * aparecer como destino inválido.
     */
    await this.ensureSubscriptionExists(subscriptionId)

    /**
     * Payload montado à mão, com **um** campo. De propósito fora do
     * `mapSubscriptionItemInputToBitrixFields`: o mapper de patch não sabe emitir
     * o campo parent, e é essa incapacidade que garante que ninguém move item ao
     * montar um `updateSubscriptionItem`. Credencial, `settings` e
     * `vinculatedChannel` são a linha do cliente — uma operação de cobrança não
     * os toca.
     */
    await this.bitrix.updateCrmItem(
      env.payments.spa.subscriptionItemEntityType,
      itemId,
      { [SUBSCRIPTION_PARENT_FIELD]: subscriptionId },
    )

    return this.getSubscriptionItem(itemId)
  }

  /**
   * Apaga o item na SPA, e nada além disso.
   *
   * A limpeza do recurso no provider e o ajuste da cobrança vêm do webhook de saída
   * que este delete dispara — mesmo caminho de quando alguém apaga pelo Bitrix.
   * Fazer aqui criaria uma segunda implementação da mesma coisa.
   *
   * Item inexistente é tratado como sucesso pelo client, e é a política certa:
   * apagar o que já não está lá chegou ao estado desejado.
   */
  async deleteSubscriptionItem(id: string): Promise<void> {
    await this.bitrix.deleteCrmItem(
      env.payments.spa.subscriptionItemEntityType,
      id,
    )
  }

  private async ensureSubscriptionExists(
    subscriptionId: string,
  ): Promise<void> {
    const response = await this.bitrix.getCrmItem(
      env.payments.spa.subscriptionEntityType,
      subscriptionId,
    )

    if (!response.result?.item) {
      throw new SubscriptionNotFoundError(subscriptionId)
    }
  }

  /**
   * Listagem sem leitura extra por item: o mapper é puro, então uma chamada a
   * `crm.item.list` resolve a coleção inteira. Item inválido propaga o erro em
   * vez de ser omitido — dado de cobrança faltando em silêncio é pior que falha.
   */
  private async list(
    filter: Record<string, unknown>,
  ): Promise<SubscriptionItem[]> {
    const response = await this.bitrix.listCrmItems(
      env.payments.spa.subscriptionItemEntityType,
      filter,
    )

    return collectBitrixSpaSubscriptionItemToSubscriptionItem(
      response.result?.items ?? [],
    )
  }
}
