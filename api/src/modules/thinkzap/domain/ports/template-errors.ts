/** Provider do conector ainda não suporta templates (ex.: Z-API). */
export class TemplatesNotSupportedError extends Error {
  constructor(provider: string) {
    super(`Provider "${provider}" não suporta gestão de templates`)
    this.name = 'TemplatesNotSupportedError'
  }
}

/**
 * Provider do conector não suporta **enviar** template.
 *
 * Irmão de `TemplatesNotSupportedError`, e não o mesmo erro: aquele fala de gestão
 * de catálogo ("não suporta gestão de templates"), e é o que a tela de conexões
 * mostra. Este é recusa de envio, e a mensagem tem de dizer isso — o operador do
 * widget não está tentando cadastrar nada.
 */
export class TemplateSendNotSupportedError extends Error {
  constructor(provider: string) {
    super(`Provider "${provider}" não suporta envio de template`)
    this.name = 'TemplateSendNotSupportedError'
  }
}

/**
 * Provider indisponível: falhou do lado dele, não por causa do que foi enviado.
 *
 * Separado da recusa de negócio de propósito. Recusa (template inexistente, idioma
 * divergente, contagem de parâmetros errada) é `4xx` e a mensagem do provider **é** a
 * informação útil — o operador corrige e reenvia. `5xx` e falha de rede não são
 * corrigíveis por ele: repassar `"barling returned status 502"` para a tela é dar um
 * erro sobre o qual não existe ação.
 *
 * A mensagem crua não se perde — vai para o log, com a causa preservada.
 */
export class TemplateProviderUnavailableError extends Error {
  constructor(readonly providerMessage: string) {
    super(
      'O WhatsApp Oficial está temporariamente indisponível. Nenhuma mensagem foi ' +
        'enviada — tente novamente em alguns minutos.',
    )
    this.name = 'TemplateProviderUnavailableError'
  }
}

/** Conector não está apto a gerenciar templates (sem WABA associada). */
export class ConnectorNotTemplateCapableError extends Error {
  constructor(connectorId: string) {
    super(
      `Conector "${connectorId}" não está apto a gerenciar templates (WABA ausente)`,
    )
    this.name = 'ConnectorNotTemplateCapableError'
  }
}

/**
 * Linha do WhatsApp Oficial cujo canal ainda não foi conectado na Meta.
 *
 * Separado de `ConnectorNotTemplateCapableError` de propósito: aquele é "esta linha
 * nunca vai ter templates" (é Z-API); este é "ainda não", e a ação do cliente é
 * conectar o número. Um erro só para os dois mandaria quem só precisa concluir a
 * conexão abrir chamado.
 */
export class ChannelNotConnectedError extends Error {
  constructor(subscriptionItemId: string) {
    super(
      `A linha "${subscriptionItemId}" ainda não teve o número conectado na Meta, então ` +
        'não há WABA para gerenciar templates. Conclua a conexão do canal primeiro.',
    )
    this.name = 'ChannelNotConnectedError'
  }
}
