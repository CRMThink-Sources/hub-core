export type WidgetAttachmentKind = 'image' | 'video' | 'audio' | 'file'

export type WidgetMessageAttachmentInput = {
  kind: WidgetAttachmentKind
  content: string
  name?: string
}

export type SendWidgetMessageInput = {
  connectorId: string
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
