/**
 * Rótulo de um conector HubMessage. Diferente da Z-API, a HubMessage não expõe
 * leitura de canal, então o nome exibido sai do que está persistido: o número,
 * quando o canal já conectou; senão um rótulo estável derivado do `channelId`.
 */
export function hubMessageConnectorLabel(instance: {
  phoneNumber?: string | null
  channelId?: string | null
  instanceId: string
}): string {
  if (instance.phoneNumber) return instance.phoneNumber

  const channelId = instance.channelId ?? instance.instanceId
  return `WhatsApp Oficial (${channelId.slice(0, 6)})`
}
