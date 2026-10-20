import type { TemplateButtonParameter } from '@/modules/thinkzap/domain/ports/template-message-sender.port'

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
  /**
   * Valores dos botões dinâmicos, com o `index` que o catálogo informou. Ausente em
   * template sem botão dinâmico.
   */
  buttonParameters?: TemplateButtonParameter[]
  /** URL `https` da imagem do cabeçalho; ausente em template sem imagem. */
  headerImageUrl?: string
  /** Corpo do template como listado, com os placeholders intactos. */
  templateBody: string
  entity: string
  entityId: string
  /**
   * Operador do Bitrix24 que disparou o envio, do JWT. Guardado na intenção para
   * rastro; template não recebe prefixo de nome — o corpo é aprovado pela Meta.
   */
  operatorBitrixUserId?: string
}

/**
 * O que o request devolve agora que a entrega é do worker.
 *
 * `sentMessageId` saiu: ele era o id atribuído pelo provider, e no momento da resposta
 * o provider ainda não foi chamado. Devolver um id inventado — ou vazio — faria o front
 * acreditar numa entrega que não aconteceu, que é exatamente o problema que enfileirar
 * veio resolver.
 */
export type EnqueueWidgetTemplateResult = {
  /** Gerado pela API; identifica a intenção para o front e para o suporte. */
  clientMessageId: string
  status: 'queued'
  destination: string
  /** Corpo com as variáveis resolvidas: o texto que o contato vai receber. */
  sentText: string
}
