import {
  SubscriptionItem,
  SubscriptionItemMetadata,
} from '@/modules/application/domain/entities/subscription-item'
import { ConnectorSettings } from '@/modules/thinkzap/domain/value-objects/connector-settings'

/**
 * Entrada de criação. `subscription` é obrigatório: item sem assinatura pai não
 * é cobrável, e o campo parent da SPA é o vínculo que torna
 * `getSubscriptionItemsBySubscription` possível.
 */
export interface CreateSubscriptionItemInput {
  name: string
  /** Id do item pai na SPA de assinaturas (1142). */
  subscription: string
  status: SubscriptionItem['status']
  metadata: SubscriptionItemMetadata
  /**
   * Opcional na criação: ausente grava `DEFAULT_CONNECTOR_SETTINGS`, não vazio.
   * Item nasce com os quatro toggles explícitos para que o campo nunca dependa
   * do fallback de leitura.
   */
  settings?: ConnectorSettings
  /**
   * Id do canal aberto. `null` **desvincula** (grava string vazia na SPA); a chave
   * ausente não mexe no vínculo.
   */
  vinculatedChannel?: string | null
  gatewayId?: string
}

/**
 * Patch parcial. `subscription` fica fora de propósito — mover um item para
 * outra assinatura é operação de negócio, não edição de campo, e tem operação
 * própria: `reparentSubscriptionItem`.
 *
 * A regra continua valendo mesmo agora que a operação existe: ninguém move item
 * por acidente ao montar um patch, e o grep pelo nome dela acha todos os lugares
 * onde a árvore de cobrança é reescrita.
 */
export type UpdateSubscriptionItemInput = Partial<
  Omit<CreateSubscriptionItemInput, 'subscription'>
>

/**
 * Contrato único: leitura e escrita na mesma interface. Não há consumidor
 * só-leitura hoje que justifique segregar — quando aparecer, extrair a
 * interface menor é refactor local.
 *
 * Sem prefixo `get-` no nome do arquivo, seguindo assinaturas: o contrato não é
 * só de leitura. Sem `deleteSubscriptionItem`: remoção é `status: 'cancelled'`,
 * não `crm.item.delete`.
 */
export interface SubscriptionItemRepository {
  getSubscriptionItem(id: string): Promise<SubscriptionItem>
  getSubscriptionItems(): Promise<SubscriptionItem[]>
  /**
   * Filtra pelo campo parent da SPA de assinaturas (`parentId1142`), então
   * recebe o id do item da SPA 1142 — é o acesso real: "o que esta assinatura
   * provisiona".
   */
  getSubscriptionItemsBySubscription(
    subscriptionId: string,
  ): Promise<SubscriptionItem[]>
  createSubscriptionItem(
    input: CreateSubscriptionItemInput,
  ): Promise<SubscriptionItem>
  updateSubscriptionItem(
    id: string,
    patch: UpdateSubscriptionItemInput,
  ): Promise<SubscriptionItem>
  /**
   * Move um item para outra assinatura, e devolve a entidade relida.
   *
   * Operação nomeada, não campo de patch: mover é reescrever a árvore de
   * cobrança, e o nome próprio é o que torna isso auditável por grep. O payload
   * enviado à SPA contém **apenas** o campo parent — credencial, `settings` e
   * `vinculatedChannel` são a linha do cliente e não podem ser tocados por uma
   * operação de cobrança.
   *
   * Assinatura destino inexistente falha, e o item permanece onde estava.
   */
  reparentSubscriptionItem(
    itemId: string,
    subscriptionId: string,
  ): Promise<SubscriptionItem>
}
