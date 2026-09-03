export type ReceivedMessageEvent = {
  notification: string
  isStatusReply: boolean
  chatLid: string | null
  /**
   * LID do remetente. Declarado opcional porque este tipo descreve o que a Z-API
   * entrega, e o campo estava chegando e sendo descartado na desserialização.
   *
   * É o fallback documentado para `chatLid` nulo. Sem ele, um evento com telefone
   * numérico e `chatLid` nulo não tem nenhum LID no payload, e a resolução da
   * identidade precisa ir ao mapa ou à própria Z-API.
   */
  senderLid?: string | null
  connectedPhone: string
  waitingMessage: boolean
  isEdit: boolean
  isGroup: boolean
  isNewsletter: boolean
  instanceId: string
  messageId: string
  phone: string
  fromMe: boolean
  momment: number
  status: string
  chatName: string
  senderPhoto: string
  senderName: string
  photo: string
  broadcast: boolean
  participantPhone: string
  participantLid: string | null
  editMessageId: string
  referenceMessageId?: string
  messageExpirationSeconds: number
  forwarded: boolean
  type: string
  fromApi: boolean
  text?: {
    message: string
  }
  audio?: {
    ptt: boolean
    seconds: number
    audioUrl: string
    mimeType: string
    viewOnce: boolean
  }
  image?: {
    imageUrl: string
    thumbnailUrl: string
    caption: string
    mimeType: string
    viewOnce: boolean
    height: number
    width: number
  }
  video?: {
    videoUrl: string
    caption: string
    mimeType: string
    width: number
    height: number
    seconds: number
    viewOnce: boolean
    isGif: boolean
  }
  document?: {
    documentUrl: string
    fileName: string
    mimeType: string
    /**
     * Legenda do documento. Faltava aqui, e por isso o texto que o contato
     * escrevia junto do arquivo não chegava ao canal aberto: o parse só olhava
     * `image.caption` e `video.caption`.
     */
    caption?: string
    title?: string
    pageCount?: number
  }
  sticker?: {
    stickerUrl: string
    mimeType: string
    width: number
    height: number
  }
  contact?: {
    displayName: string
    vCard: string
    phones: string[]
  }
  reaction: {
    value: string
    time: number
    reactionBy: string
    referencedMessage: {
      messageId: string
      fromMe: boolean
      phone: string
      participant: string
    }
  }
  _traceContext: {
    traceId: string
    spanId: string
  }
}

export type ZApiConnectedEvent = {
  type: string
  connected: boolean
  momment: number
  instanceId: string
  phone: string
  lid: string
  isBusiness: boolean
}

export type ZApiDisconectedEvent = {
  type: string
  disconnected: boolean
  momment: number
  instanceId: string
  phone: string
  lid: string
  isBusiness: boolean
}

export type StatusCallbackEvent = {
  instanceId: string
  status: string
  ids: string[]
  moment: number
  phoneDevice: number
  phone: string
  type: string
  isGroup: boolean
}
