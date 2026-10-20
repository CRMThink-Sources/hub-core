/**
 * Contrato neutro para **enviar** um template aprovado ao contato, independente
 * do provider concreto.
 *
 * Separado de `WhatsAppTemplateProvider` de propósito: aquele é o ciclo de vida
 * do catálogo e é escopado por **WABA** (listar/cadastrar/sincronizar); este é
 * envio, escopado por **canal + destinatário**. Um port só para os dois obrigaria
 * a assinatura de envio a carregar um `wabaId` que não usa, e o adapter a receber
 * um `channelId` que a assinatura não tem por onde entregar.
 *
 * Espelha o par `OutboundMessageSender` + `OutboundSenderResolver`, que resolve o
 * mesmo problema para mensagem livre. As implementações vivem em `infra` como
 * adapters e NÃO devem vazar tipos específicos de provider (`HubMessageClient`,
 * `HubMessageApiError`) para a camada de aplicação.
 */

/** O template a enviar, na forma neutra do domínio. */
export type TemplateMessageDescriptor = {
  /** Nome do template aprovado, como cadastrado na Meta. */
  templateName: string
  /** Idioma do template (ex.: `pt_BR`). Com `templateName`, identifica a versão. */
  language: string
  /**
   * Valores das variáveis do corpo, **na ordem posicional** das variáveis.
   *
   * Posicional cobre os dois formatos de parâmetro da Meta: template `NAMED`
   * (`{{nome}}`) também é consumido por posição, desde que a ordem seja a de
   * aparição no corpo. Vazio em template sem variável.
   */
  bodyParameters: string[]
  /**
   * Valores dos botões dinâmicos, cada um amarrado à posição do botão no template.
   * Vazio ou ausente em template sem botão dinâmico — botão estático não leva
   * parâmetro.
   */
  buttonParameters?: TemplateButtonParameter[]
  /**
   * URL pública `https` da imagem do cabeçalho, em template com cabeçalho de imagem
   * (a Meta exige a imagem em todo envio). Ausente em template sem esse cabeçalho.
   */
  headerImageUrl?: string
}

/**
 * Valor de um botão dinâmico no envio.
 *
 * `index` é a posição do botão entre **todos** os botões do template aprovado, a
 * partir de 0 — é o que a Meta usa para saber qual botão recebe o valor. `URL`
 * completa a variável do fim da URL; `COPY_CODE` é o código do cupom.
 */
export type TemplateButtonParameter = {
  index: number
  subType: 'URL' | 'COPY_CODE'
  value: string
}

export type TemplateSendResult = {
  /** Id atribuído pelo provider, persistido como `providerMessageId`. */
  messageId: string
}

export interface TemplateMessageSender {
  /**
   * Capacidade de enviar template. Quando `false`, `send` lança — o chamador não
   * precisa de `instanceof` para degradar, mesmo padrão de `supportsTemplates` e
   * `supportsReply`.
   */
  readonly supportsTemplateSend: boolean

  /** Envia o template e devolve o id atribuído pelo provider. */
  send(descriptor: TemplateMessageDescriptor): Promise<TemplateSendResult>
}
