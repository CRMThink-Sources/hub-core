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
  /**
   * Operador do Bitrix24 que clicou em enviar, do JWT. É o que resolve o nome no
   * prefixo — ausente, o envio sai sem prefixo.
   */
  operatorBitrixUserId?: string
  /**
   * Âncoras da campanha de SMS do Bitrix, presentes **só** quando o envio veio do
   * handler de `messageservice`. É por elas que o worker sabe para onde reportar o
   * status — envio de widget não tem para onde, e as deixa vazias.
   */
  smsSenderCode?: string
  smsMessageId?: string
}

export type SendWidgetMessageResult = {
  message: string
  destination: string
  sentMessageIds: string[]
}
