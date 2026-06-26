export type ReceivedMessageEvent = {
  notification: string
  isStatusReply: boolean
  chatLid: string | null
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
