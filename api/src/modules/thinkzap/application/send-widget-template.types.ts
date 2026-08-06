export type SendWidgetTemplateInput = {
  /** Id do item de assinatura — a linha, mesma chave do envio livre do widget. */
  subscriptionItemId: string
  /** Uuid de `core_domains`, do JWT. */
  domainId: string
  /** `core_app_codes.id`, do JWT. */
  appCode: string
  destination: string
  /** Nome do template aprovado, como listado por `/messages/widget-templates`. */
  templateName: string
  language: string
  /**
   * Valores das variáveis do corpo, **na ordem de aparição** dos placeholders. O
   * front monta a ordem; aqui ela só é repassada.
   */
  bodyParameters: string[]
  /** Corpo do template como listado, com os placeholders intactos. */
  templateBody: string
  entity: string
  entityId: string
}

export type SendWidgetTemplateResult = {
  message: string
  destination: string
  /** Id atribuído pelo provider — persistido como `providerMessageId`. */
  sentMessageId: string
  /** Corpo com as variáveis resolvidas: o texto que o contato recebeu. */
  sentText: string
}
