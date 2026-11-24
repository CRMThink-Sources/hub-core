export interface SendNotificationInput {
  contextId: string
  entity: string
  message: string
  /**
   * Usuário do Bitrix em cujo nome o comentário deve aparecer na timeline (quem
   * enviou). Ausente, ou sem token utilizável, o comentário sai com a credencial da
   * instalação, como sempre foi.
   */
  authorBitrixUserId?: string
  /**
   * Monta a linha que nomeia o remetente. Só é usada quando o comentário cai na
   * credencial da instalação: aí o autor exibido é quem instalou o app, e o nome
   * correto precisa estar no texto.
   */
  senderLine?: (name: string) => string
}

export interface SendNotification {
  execute(input: SendNotificationInput): Promise<void>
}
