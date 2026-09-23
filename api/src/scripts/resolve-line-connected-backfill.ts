/**
 * A parte **pura** do backfill do campo Conectado (`UF_CRM_93_CONNECTED`): campos
 * crus do item → de onde ler o status, e status lido → escrever ou não.
 *
 * Separada do runner porque é onde está a decisão. O runner faz rede: lista os
 * itens, consulta o provider e escreve na SPA.
 */

export type LineConnectedBackfillItem = {
  itemId: string
  provider: string
  zApiInstanceId?: string
  zApiInstanceToken?: string
  hubmessageChannelId?: string
  wabaId?: string
  deleted: boolean
}

export type LineConnectedBackfillSource =
  | { kind: 'zapi'; itemId: string; instanceId: string; token: string }
  /**
   * Sem `wabaId` o canal nunca concluiu o embedded signup — desconectado sem
   * consultar nada, como em `connector-connection-status`.
   */
  | { kind: 'hubmessage'; itemId: string; wabaId?: string }
  | {
      kind: 'skipped'
      itemId: string
      reason:
        | 'excluido'
        | 'sem-conector'
        | 'provider-desconhecido'
        | 'sem-credencial'
    }

export const resolveLineConnectedSource = (
  item: LineConnectedBackfillItem,
): LineConnectedBackfillSource => {
  const { itemId } = item

  if (item.deleted) return { kind: 'skipped', itemId, reason: 'excluido' }

  switch (item.provider.trim().toUpperCase()) {
    case 'ZAPI':
      if (!item.zApiInstanceId || !item.zApiInstanceToken) {
        return { kind: 'skipped', itemId, reason: 'sem-credencial' }
      }
      return {
        kind: 'zapi',
        itemId,
        instanceId: item.zApiInstanceId,
        token: item.zApiInstanceToken,
      }
    case 'HUBMESSAGE':
      if (!item.hubmessageChannelId) {
        return { kind: 'skipped', itemId, reason: 'sem-credencial' }
      }
      return {
        kind: 'hubmessage',
        itemId,
        ...(item.wabaId ? { wabaId: item.wabaId } : {}),
      }
    case 'NONE':
      return { kind: 'skipped', itemId, reason: 'sem-conector' }
    default:
      return { kind: 'skipped', itemId, reason: 'provider-desconhecido' }
  }
}

/**
 * Status da WABA pelo agregado de `GET /whatsapp/businesses`: conectada quando
 * `connectedCount > 0`. Sem `wabaId`, ou WABA ausente da lista, é desconectada.
 */
export const resolveHubMessageConnected = (
  wabaId: string | undefined,
  connectedCountByWaba: ReadonlyMap<string, number>,
): boolean => (wabaId ? (connectedCountByWaba.get(wabaId) ?? 0) > 0 : false)
