export type WidgetAttachmentKind = 'image' | 'video' | 'audio' | 'file'

export type WidgetMessageAttachmentInput = {
  kind: WidgetAttachmentKind
  content: string
  name?: string
}

export type SendWidgetMessageInput = {
  /**
   * Id do item de assinatura — a linha. Era `connectorId`: o widget agora recebe e
   * devolve a mesma chave que a tela de ajustes e os grupos usam, e `Connector`
   * saiu do caminho.
   */
  subscriptionItemId: string
  /** Uuid de `core_domains`, do JWT. */
  domainId: string
  /** `core_app_codes.id`, do JWT. */
  appCode: string
  destination: string
  message?: string
  attachments?: WidgetMessageAttachmentInput[]
  entity: string
  entityId: string
}

export type SendWidgetMessageResult = {
  message: string
  destination: string
  sentMessageIds: string[]
}
