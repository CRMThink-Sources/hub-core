import { ButtonAction } from '@/modules/thinkzap/domain/ports/interactive-button-sender.port'

export type SendWidgetButtonInput = {
  subscriptionItemId: string
  domainId: string
  appCode: string
  destination: string
  body: string
  header?: string
  footer?: string
  buttons: ButtonAction[]
  entity: string
  entityId: string
  /** Do token da requisição — rastro na intenção; botão não recebe prefixo de nome. */
  operatorBitrixUserId?: string
}

/**
 * O que o request devolve agora que a entrega é do worker — mirror de
 * `EnqueueWidgetTemplateResult`.
 */
export type EnqueueWidgetButtonResult = {
  clientMessageId: string
  status: 'queued'
  destination: string
}
