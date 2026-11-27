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

/**
 * Comentário já na timeline. `asAuthor` diz com qual credencial ele saiu, para a
 * edição usar a mesma.
 */
export type PublishedComment = { commentId: string; asAuthor: boolean }

export interface TimelineCommentPublisher {
  /**
   * `null` = não há comentário para editar depois. Não significa que ele não saiu:
   * numa falha ambígua o Bitrix pode ter gravado, então não publique de novo.
   */
  publish(input: SendNotificationInput): Promise<PublishedComment | null>
  /** `false` = o comentário não existe mais. Falha temporária lança. */
  update(input: SendNotificationInput & PublishedComment): Promise<boolean>
}
