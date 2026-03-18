export type ReceivedMessageEvent = {
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
  referenceMessageId: string
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
  _traceContext: {
    traceId: string
    spanId: string
  }
}
