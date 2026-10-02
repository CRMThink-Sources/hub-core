/**
 * O tipo de botão pedido não é suportado pelo provider resolvido.
 *
 * Hoje a HubMessage recusa `CALL` — a doc dela promete o tipo, mas a Cloud
 * API da Meta não tem botão de ligação em mensagem de sessão livre (só
 * existe em template aprovado, botão `PHONE_NUMBER`); confirmado contra a
 * API real em 2026-09-15: `CALL` sozinho voltou `400` da Meta ("missing:
 * action"), e `CALL` combinado com `URL` foi silenciosamente descartado.
 * `REPLY` e `URL` são aceitos (não juntos — ver `InvalidButtonCombinationError`). O
 * adapter lança isto **antes** de qualquer chamada remota — validar depois
 * de bater na API trocaria um erro claro por um `4xx` genérico do provider
 * (ou pior: um envio parcial sem erro nenhum).
 */
export class UnsupportedButtonTypeError extends Error {
  constructor(
    readonly provider: string,
    readonly buttonType: string,
  ) {
    super(`Provider "${provider}" não suporta botão do tipo "${buttonType}"`)
    this.name = 'UnsupportedButtonTypeError'
  }
}

/**
 * O descriptor mistura tipos de botão que o provider não permite combinar no
 * mesmo envio.
 *
 * Z-API: o WhatsApp Web rejeita misturar `REPLY` com `CALL`/`URL` no mesmo
 * envio (`CALL` e `URL` entre si podem conviver). HubMessage: `REPLY`
 * (`INTERACTIVE_BUTTON`) e `URL` (`INTERACTIVE_ACTION`) são rotas diferentes
 * da API — não existe envio que combine os dois. O adapter lança isto antes
 * de qualquer chamada remota, pelo mesmo motivo de `UnsupportedButtonTypeError`.
 */
export class InvalidButtonCombinationError extends Error {
  constructor(readonly provider: string) {
    super(
      `Provider "${provider}" não aceita misturar botão de resposta rápida com botão de link/ligação no mesmo envio`,
    )
    this.name = 'InvalidButtonCombinationError'
  }
}

/**
 * O envio tem mais botões do que o provider aceita numa mensagem só.
 *
 * Todo provider recusa acima de `MAX_BUTTONS_PER_SEND` (5). A HubMessage tem
 * limites menores: o botão de URL da Meta (`cta_url`) é uma
 * mensagem interativa de **um botão só** — não existe combinação de vários
 * botões de URL/CALL numa mensagem de sessão livre, ao contrário do que a doc
 * da HubMessage sugere (confirmado contra a API real em 2026-09-15). O quick
 * reply (`REPLY`) tem limite próprio, mais alto (3) — confirmado em
 * 2026-09-18: o 4º fez a Meta recusar a mensagem inteira.
 */
export class TooManyButtonsError extends Error {
  constructor(
    readonly provider: string,
    readonly max: number,
  ) {
    super(`Provider "${provider}" aceita no máximo ${max} botão(ões) por envio`)
    this.name = 'TooManyButtonsError'
  }
}

/**
 * Provider indisponível no envio de botões: falhou do lado dele, não por
 * causa do que foi enviado. Mirror de `TemplateProviderUnavailableError` —
 * ver o porquê da separação lá.
 */
export class ButtonProviderUnavailableError extends Error {
  constructor(readonly providerMessage: string) {
    super(
      'O provider de WhatsApp está temporariamente indisponível. Nenhuma mensagem ' +
        'foi enviada — tente novamente em alguns minutos.',
    )
    this.name = 'ButtonProviderUnavailableError'
  }
}

/**
 * Linha apta a enviar botões (provider certo, habilitada) mas sem canal
 * conectado no provider: HubMessage sem `wabaId` (número não conectado na
 * Meta) ou Z-API cuja leitura de status devolveu desconectado.
 *
 * Erro próprio, e não `ChannelNotConnectedError` de `template-errors.ts`: a
 * mensagem daquele fala de "gerenciar templates", texto errado para quem só
 * está tentando mandar botão.
 */
export class ButtonChannelNotConnectedError extends Error {
  constructor(subscriptionItemId: string) {
    super(
      `A linha "${subscriptionItemId}" não está com o canal conectado. Conclua a conexão antes de enviar botões.`,
    )
    this.name = 'ButtonChannelNotConnectedError'
  }
}

/**
 * Nenhum adapter registrado para o provider resolvido — defesa contra
 * ambiente mal configurado (ex.: HubMessage sem `HUBMESSAGE_SECRET_KEY`), já
 * que em operação normal os dois providers suportados têm adapter real.
 */
export class InteractiveButtonSendNotSupportedError extends Error {
  constructor(readonly provider: string) {
    super(`Provider "${provider}" não tem envio de botões configurado`)
    this.name = 'InteractiveButtonSendNotSupportedError'
  }
}
