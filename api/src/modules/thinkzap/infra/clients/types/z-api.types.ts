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
