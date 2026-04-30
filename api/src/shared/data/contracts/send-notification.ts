export interface SendNotificationInput {
  contextId: string
  entity: string
  message: string
}

export interface SendNotification {
  execute(input: SendNotificationInput): Promise<void>
}
