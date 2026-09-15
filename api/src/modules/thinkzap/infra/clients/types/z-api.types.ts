export type CreateZApiInstanceParams = {
  name: string
  sessionName: string
  deliveryCallbackUrl: string
  receivedCallbackUrl: string
  disconnectedCallbackUrl: string
  connectedCallbackUrl: string
  messageStatusCallbackUrl: string
}

export type CreateZApiInstanceResponse = {
  id: string
  token: string
  due: number
}

export type ListZApiInstancesResponse = ZApiListResponse<{
  receivedAndDeliveryCallbackUrl: string | null
  presenceChatCallbackUrl: string | null
  initialDataCallbackUrl: string | null
  receivedStatusCallbackUrl: string | null
  blockCallbackUrl: string | null
  created: string
  disconnectedCallbackUrl: string
  autoReadMessage: boolean
  callRejectAuto: boolean
  token: string
  phoneConnected: boolean
  deliveryCallbackUrl: string
  due: number
  whatsappConnected: boolean
  name: string
  connectedCallbackUrl: string
  messageStatusCallbackUrl: string
  autoReadStatus: boolean
  id: string
  receivedCallbackUrl: string
  tenant: string
  paymentStatus: string
  callRejectMessage: string | null
  middleware: string | null
}>

export type InstanceDataResponse = {
  receivedAndDeliveryCallbackUrl: string
  presenceChatCallbackUrl: string
  created: string
  disconnectedCallbackUrl: string
  autoReadMessage: boolean
  token: string
  connected: boolean
  receiveCallbackSentByMe: boolean
  deliveryCallbackUrl: string
  due: number
  name: string
  connectedCallbackUrl: string
  messageStatusCallbackUrl: string
  id: string
  receivedCallbackUrl: string
  paymentStatus: string
}

export type InstanceStatusResponse = {
  connected: boolean
  session: string
  created: string
  error: string | null
  smartphoneConnected: boolean
}

export type PhoneDataResponse = {
  phone: string
  lid: string
  imgUrl: string
  about: string
  name: string
  device: {
    sessionName: string
    device_model: string
  }
  originalDevice: string
  sessionId: number
  isBusiness: boolean
}

export type ZApiListResponse<T> = {
  total: number
  totalPage: number
  pageSize: number
  page: number
  content: T[]
}

export type CreateGroupParams = {
  autoInvite: boolean
  groupName: string
  phones: string[]
}

export type CreateGroupResponse = {
  phone: string
  invitationLink: string
}

export type ZApiGroupListItem = {
  isGroup: boolean
  name: string
  phone: string
  unread: string
  lastMessageTime: string
  isMuted: string
  isMarkedSpam: string
  archived: string
  pinned: string
  muteEndTime: string | null
  messagesUnread: string
}

export type ZApiGroupParticipant = {
  phone: string
  isAdmin: boolean
  isSuperAdmin: boolean
  short?: string
  name?: string
  imgUrl?: string | null
  /**
   * Só existe aqui — não em `PhoneExistsResponse` — porque a Z-API entrega
   * `phone` e `lid` já pareados por participante de grupo. É a única direção
   * lid→telefone que não depende de `phone-exists`.
   */
  lid?: string
}

export type ProfilePictureResponse = { link: string } | Array<{ link: string }>

/**
 * Resposta de `phone-exists`. A Z-API devolve um array, mesmo consultando um número só.
 *
 * O `lid` é o motivo desta chamada existir no produto: é a única direção de conversão
 * que o WhatsApp permite. `lid` → telefone é impossível; telefone → `lid` é isto aqui.
 *
 * `lid` vem nulo quando `exists` é `false` — número que não tem WhatsApp não tem LID.
 */
export type PhoneExistsResponse = Array<{
  exists: boolean
  phone: string
  lid: string | null
}>

export type ZApiGroupMetadata = {
  phone: string
  description: string
  owner: string
  subject: string
  creation: number
  invitationLink: string | null
  communityId: string | null
  adminOnlyMessage: boolean
  adminOnlySettings: boolean
  requireAdminApproval: boolean
  isGroupAnnouncement: boolean
  participants: ZApiGroupParticipant[]
  subjectTime?: number
  subjectOwner?: string
  photoUrl?: string | null
}

export type ZApiBooleanResponse = {
  value: boolean
}

export type AddGroupParticipantsParams = {
  autoInvite: boolean
  groupId: string
  phones: string[]
}

export type RemoveGroupParticipantsParams = {
  groupId: string
  phones: string[]
}

export type UpdateGroupNameParams = {
  groupId: string
  groupName: string
}

export type UpdateGroupDescriptionParams = {
  groupId: string
  groupDescription: string
}

export type UpdateGroupPhotoParams = {
  groupId: string
  groupPhoto: string
}

export type LeaveGroupParams = {
  groupId: string
}
