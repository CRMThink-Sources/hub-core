export type WidgetAttachmentKind = 'image' | 'video' | 'audio' | 'file'

export type SendWidgetAttachment = {
  kind: WidgetAttachmentKind
  name: string
  file: File
}

export type BuildSendWidgetFormDataInput = {
  connectorId: string
  destination: string
  message?: string
  entity: string
  entityId: string
  attachments: SendWidgetAttachment[]
}

export function buildSendWidgetFormData(
  input: BuildSendWidgetFormDataInput,
): FormData {
  const formData = new FormData()

  formData.append('connectorId', input.connectorId)
  formData.append('destination', input.destination)
  if (input.message?.trim()) {
    formData.append('message', input.message.trim())
  }
  formData.append('entity', input.entity)
  formData.append('entityId', input.entityId)

  const attachmentsMeta = input.attachments.map(item => ({
    kind: item.kind,
    name: item.name,
  }))

  formData.append('attachmentsMeta', JSON.stringify(attachmentsMeta))

  for (const item of input.attachments) {
    formData.append('files', item.file, item.name)
  }

  return formData
}
