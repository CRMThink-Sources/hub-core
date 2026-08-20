/**
 * Contrato neutro para o envio de uma mensagem ao contato no WhatsApp,
 * independente do provider concreto (Z-API, HubMessage). As implementações
 * vivem em `infra` como adapters e NÃO devem vazar tipos específicos de
 * provider (`ZApiClient`, `HubMessageClient`, `HubMessageApiError`) para a
 * camada de aplicação.
 *
 * Complementa `WhatsAppConnectorProvider`, que cobre só o ciclo de vida do
 * conector: provisionar, assinar, cancelar, desconectar.
 */

/** Tipo de mídia da mensagem, já normalizado a partir do evento do Bitrix. */
export type OutboundMessageKind =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'

/**
 * Descritor neutro de uma mensagem a enviar. O chamador monta os mesmos dados
 * para qualquer provider — a degradação de recursos não suportados fica contida
 * no adapter.
 */
export type OutboundMessageDescriptor = {
  kind: OutboundMessageKind
  /**
   * Corpo da mensagem em `text`; **legenda** da mídia em `image`, `video` e
   * `document`.
   *
   * Um campo só, e não um `caption` separado: os dois teriam o mesmo destino a
   * jusante (`sentText`, coluna `text` do banco, preparo do texto do operador) e
   * abririam um estado inválido novo — corpo e legenda preenchidos no mesmo
   * descritor.
   *
   * `audio` não suporta legenda (nota de voz não tem campo de texto no
   * WhatsApp): o chamador emite o texto como descritor `text` separado, e o
   * adapter ignora texto que chegue aqui.
   */
  text?: string
  /** URL do arquivo (`downloadLink` do Bitrix). Presente em mídia e documento. */
  url?: string
  /** Nome do arquivo. Presente em `document`. */
  fileName?: string
  mime?: string
}

export type OutboundSendOptions = {
  /**
   * Id de mensagem do provider a citar. Providers sem suporte a reply ignoram
   * o campo e registram log — ver `supportsReply`.
   */
  referencedMessageId?: string
}

export type OutboundSendResult = {
  /** Id atribuído pelo provider, persistido como `providerMessageId`. */
  messageId: string
  /** Tipo efetivamente persistido — pode divergir do envio quando o adapter degrada (ex.: documento enviado como texto). */
  persistedType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT'
  /**
   * Texto efetivamente enviado: o corpo em `text`, a legenda em mídia legendada,
   * ou o texto que o adapter constrói ao degradar (ex.: fallback de documento).
   * É o que o chamador persiste na coluna `text` — mídia sem legenda devolve
   * `undefined` e continua gravando `null`.
   */
  sentText?: string
}

export interface OutboundMessageSender {
  /**
   * Capacidade de citar mensagem anterior. Quando `false`, o chamador não deve
   * sequer resolver a referência — evita consulta inútil ao banco.
   */
  readonly supportsReply: boolean

  /** Envia a mensagem e devolve o id atribuído pelo provider. */
  send(
    descriptor: OutboundMessageDescriptor,
    options?: OutboundSendOptions,
  ): Promise<OutboundSendResult>
}
