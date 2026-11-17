/**
 * Quem mais usa um recurso remoto. É a guarda antes de desassinar: quando o suporte
 * migra uma linha colando a credencial num item novo e cancela o antigo, desassinar
 * pelo antigo cortaria a linha que está em uso.
 */
export interface ActiveResourceUsage {
  /** Ids dos outros itens `active` e não excluídos com a mesma credencial. */
  listOtherActiveItemIds(
    resource: { provider: 'ZAPI' | 'HUBMESSAGE'; instanceId: string },
    exceptItemId: string,
  ): Promise<string[]>
}
