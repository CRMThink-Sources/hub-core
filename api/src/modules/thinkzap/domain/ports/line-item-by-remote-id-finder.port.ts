/**
 * Localiza o item da SPA 1146 de uma linha a partir do identificador **remoto** que
 * chega num evento do provider — o `instanceId` da Z-API ou o `channelId` da
 * HubMessage.
 *
 * Existe porque os eventos de conexão não trazem domínio nem item: o caminho antigo
 * resolvia `Instance` → domínio → contexto da aplicação, e as linhas provisionadas
 * pela SPA não têm `Instance`. A SPA do portal da CRMThink é uma só, então filtrar
 * por credencial nela é uma chamada e não depende do Prisma.
 *
 * Só itens **vivos**: exclusão lógica (`ufCrm93DeletedAt`) fica de fora.
 */
export type LineItemConnectionTarget = {
  id: string
  /** `ufCrm93Connected` lido; `null` = nunca registrado. */
  connected: boolean | null
  /** Credencial Z-API do item, para reler o status ao vivo. Ausente na HubMessage. */
  zApiInstanceToken?: string
}

export interface LineItemByRemoteIdFinder {
  findLiveByZApiInstanceId(
    instanceId: string,
  ): Promise<LineItemConnectionTarget[]>
  findLiveByHubMessageChannelId(
    channelId: string,
  ): Promise<LineItemConnectionTarget[]>
}
