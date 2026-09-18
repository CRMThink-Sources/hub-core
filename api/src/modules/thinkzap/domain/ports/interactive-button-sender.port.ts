/**
 * Contrato neutro para **enviar** uma mensagem com botões de ação (resposta
 * rápida, link ou ligação) a um destinatário, independente do provider
 * concreto.
 *
 * Ao contrário de `TemplateMessageSender`, os dois providers hoje suportados
 * (`ZAPI` e `HUBMESSAGE`) têm adapter real — não existe caminho "unsupported"
 * por provider inteiro. O que diverge por provider é o **tipo de botão**
 * aceito, e essa validação vive em cada adapter (ver
 * `whatsapp-button-message-send` spec).
 */

/** Tipo do botão, na forma neutra do domínio. */
export type ButtonActionType = 'REPLY' | 'URL' | 'CALL'

/**
 * Um botão do descriptor. `url` só é usado (e obrigatório em intenção) para
 * `type: 'URL'`; `phone` só para `type: 'CALL'`. `REPLY` não usa campo extra
 * além de `id`/`label`.
 */
export type ButtonAction = {
  id: string
  label: string
  type: ButtonActionType
  url?: string
  phone?: string
}

/** A mensagem com botões a enviar, na forma neutra do domínio. */
export type InteractiveButtonDescriptor = {
  /** Corpo da mensagem. */
  body: string
  /** Título opcional, exibido acima do corpo. */
  header?: string
  /** Rodapé opcional, exibido abaixo dos botões. */
  footer?: string
  buttons: ButtonAction[]
}

export type InteractiveButtonSendResult = {
  /** Id atribuído pelo provider, persistido como `providerMessageId`. */
  messageId: string
}

export interface InteractiveButtonSender {
  /** Envia a mensagem com botões e devolve o id atribuído pelo provider. */
  send(
    descriptor: InteractiveButtonDescriptor,
  ): Promise<InteractiveButtonSendResult>
}
