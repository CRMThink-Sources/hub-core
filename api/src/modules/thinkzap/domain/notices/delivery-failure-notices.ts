import type { NoticeLocale } from './notice-locale'

/**
 * Frases da recusa da Meta depois do aceite (callback de estado da HubMessage), por
 * idioma. A escolha da frase — código, texto, genérica — fica em
 * `describe-hubmessage-delivery-failure.ts`; aqui só o que o operador lê.
 */
export type MetaErrorCode =
  | '131047'
  | '131026'
  | '131048'
  | '131049'
  | '131051'
  | '132000'
  | '132001'
  | '132015'
  | '132016'

export type DeliveryFailureNotices = {
  prefix: string
  byCode: Record<MetaErrorCode, string>
  displayName: string
  reengagement: string
  invalidRecipient: string
  rateLimit: string
  noReason: string
  /** `code` opcional vai entre parênteses; `raw` é o retorno do provedor, como veio. */
  generic: (code: string | undefined, raw: string) => string
}

function build(texts: {
  prefix: string
  reengagement: string
  rest: Omit<Record<MetaErrorCode, string>, '131047'>
  displayName: string
  invalidRecipient: string
  rateLimit: string
  noReason: string
  generic: (code: string | undefined, raw: string) => string
}): DeliveryFailureNotices {
  return {
    prefix: texts.prefix,
    // 131047 e o casamento por texto são o mesmo erro por duas portas: um texto só.
    byCode: { '131047': texts.reengagement, ...texts.rest },
    displayName: texts.displayName,
    reengagement: texts.reengagement,
    invalidRecipient: texts.invalidRecipient,
    rateLimit: texts.rateLimit,
    noReason: texts.noReason,
    generic: texts.generic,
  }
}

const NOTICES: Record<NoticeLocale, DeliveryFailureNotices> = {
  pt: build({
    prefix: '⚠️ Sua mensagem não foi entregue: ',
    reengagement:
      'a janela de 24 horas desta conversa está fechada — o contato respondeu por último ' +
      'há mais de 24 horas, e o WhatsApp Oficial só aceita mensagem livre dentro dessa ' +
      'janela. Envie um novo template aprovado pelo widget do CRMThink para reabrir a ' +
      'conversa; depois que o contato responder, a mensagem livre volta a sair.',
    rest: {
      '131026':
        'o WhatsApp não conseguiu entregar a mensagem a este número. Em geral é número ' +
        'sem WhatsApp ativo, ou uma conta que não aceita receber deste remetente. ' +
        'Confira o telefone no CRM antes de tentar de novo.',
      '131048':
        'a Meta bloqueou novos envios deste número por limite de spam. Aguarde antes de ' +
        'tentar de novo e reveja o volume de mensagens disparadas.',
      '131049':
        'a Meta recusou esta mensagem de marketing para preservar o engajamento do ' +
        'contato. Não é falha da linha: este contato não vai receber envios de marketing ' +
        'agora.',
      '131051':
        'o tipo desta mensagem não é aceito pelo WhatsApp Oficial. Reenvie como texto ou ' +
        'como um anexo de tipo suportado.',
      '132000':
        'o template foi enviado com um número de variáveis diferente do que a Meta ' +
        'aprovou. Confira os campos do template antes de reenviar.',
      '132001':
        'este template não existe na conta do WhatsApp Oficial (ou não está aprovado no ' +
        'idioma usado). Escolha um template aprovado na lista do widget.',
      '132015':
        'a Meta pausou este template por baixa qualidade, e ele não envia enquanto ' +
        'estiver pausado. Use outro template aprovado.',
      '132016':
        'este template foi desativado pela Meta e não envia mais. Use outro template ' +
        'aprovado.',
    },
    displayName:
      'o número deste WhatsApp Oficial ainda não teve o nome de exibição aprovado ' +
      'pela Meta, e nenhuma mensagem sai até a aprovação sair. A liberação é feita no ' +
      'Gerenciador do WhatsApp da conta Meta do cliente.',
    invalidRecipient:
      'o número do contato não tem WhatsApp ativo (ou está escrito de forma ' +
      'inválida). Confira o telefone no CRM antes de tentar de novo.',
    rateLimit:
      'o limite de envio da Meta para este número foi atingido. Tente de novo em ' +
      'alguns instantes.',
    noReason:
      'o WhatsApp Oficial recusou o envio e não informou o motivo. ' +
      'Verifique a conexão da linha e tente novamente.',
    generic: (code, raw) =>
      `o WhatsApp Oficial recusou o envio${code ? ` (erro ${code})` : ''}. Retorno do provedor: ` +
      raw,
  }),
  en: build({
    prefix: '⚠️ Your message was not delivered: ',
    reengagement:
      "this conversation's 24-hour window is closed — the contact last replied more " +
      'than 24 hours ago, and WhatsApp Official only accepts free-form messages within ' +
      'that window. Send a new approved template from the CRMThink widget to reopen the ' +
      'conversation; once the contact replies, free-form messages go through again.',
    rest: {
      '131026':
        'WhatsApp could not deliver the message to this number. This is usually a ' +
        'number without an active WhatsApp account, or an account that does not accept ' +
        'messages from this sender. Check the phone number in the CRM before trying again.',
      '131048':
        'Meta blocked new messages from this number due to its spam limit. Wait before ' +
        'trying again and review the volume of messages being sent.',
      '131049':
        "Meta declined this marketing message to preserve the contact's engagement. It " +
        'is not a line failure: this contact will not receive marketing messages right now.',
      '131051':
        'this message type is not accepted by WhatsApp Official. Resend it as text or as ' +
        'an attachment of a supported type.',
      '132000':
        'the template was sent with a different number of variables than Meta approved. ' +
        'Check the template fields before resending.',
      '132001':
        'this template does not exist in the WhatsApp Official account (or is not ' +
        'approved in the language used). Choose an approved template from the widget list.',
      '132015':
        'Meta paused this template due to low quality, and it does not send while ' +
        'paused. Use another approved template.',
      '132016':
        'this template was disabled by Meta and no longer sends. Use another approved ' +
        'template.',
    },
    displayName:
      "this WhatsApp Official number's display name has not been approved by Meta yet, " +
      'and no messages go out until it is approved. Approval is done in WhatsApp Manager ' +
      "in the customer's Meta account.",
    invalidRecipient:
      "the contact's number has no active WhatsApp account (or is written in an " +
      'invalid format). Check the phone number in the CRM before trying again.',
    rateLimit:
      "Meta's sending limit for this number has been reached. Try again in a few moments.",
    noReason:
      'WhatsApp Official declined the message and did not give a reason. ' +
      'Check the line connection and try again.',
    generic: (code, raw) =>
      `WhatsApp Official declined the message${code ? ` (error ${code})` : ''}. Provider response: ` +
      raw,
  }),
  es: build({
    prefix: '⚠️ Su mensaje no fue entregado: ',
    reengagement:
      'la ventana de 24 horas de esta conversación está cerrada — el contacto respondió ' +
      'por última vez hace más de 24 horas, y WhatsApp Oficial solo acepta mensajes ' +
      'libres dentro de esa ventana. Envíe una nueva plantilla aprobada desde el widget de ' +
      'CRMThink para reabrir la conversación; cuando el contacto responda, los mensajes ' +
      'libres vuelven a salir.',
    rest: {
      '131026':
        'WhatsApp no pudo entregar el mensaje a este número. En general es un número sin ' +
        'WhatsApp activo, o una cuenta que no acepta recibir de este remitente. Revise el ' +
        'teléfono en el CRM antes de intentar de nuevo.',
      '131048':
        'Meta bloqueó nuevos envíos de este número por límite de spam. Espere antes de ' +
        'intentar de nuevo y revise el volumen de mensajes enviados.',
      '131049':
        'Meta rechazó este mensaje de marketing para preservar el compromiso del contacto. ' +
        'No es una falla de la línea: este contacto no recibirá envíos de marketing por ahora.',
      '131051':
        'el tipo de este mensaje no es aceptado por WhatsApp Oficial. Reenvíelo como texto ' +
        'o como un adjunto de tipo compatible.',
      '132000':
        'la plantilla se envió con un número de variables distinto del que Meta aprobó. ' +
        'Revise los campos de la plantilla antes de reenviar.',
      '132001':
        'esta plantilla no existe en la cuenta de WhatsApp Oficial (o no está aprobada en ' +
        'el idioma usado). Elija una plantilla aprobada de la lista del widget.',
      '132015':
        'Meta pausó esta plantilla por baja calidad, y no se envía mientras esté pausada. ' +
        'Use otra plantilla aprobada.',
      '132016':
        'esta plantilla fue desactivada por Meta y ya no se envía. Use otra plantilla ' +
        'aprobada.',
    },
    displayName:
      'el número de este WhatsApp Oficial todavía no tiene el nombre visible aprobado ' +
      'por Meta, y ningún mensaje sale hasta la aprobación. La liberación se hace en el ' +
      'Administrador de WhatsApp de la cuenta Meta del cliente.',
    invalidRecipient:
      'el número del contacto no tiene WhatsApp activo (o está escrito de forma ' +
      'inválida). Revise el teléfono en el CRM antes de intentar de nuevo.',
    rateLimit:
      'se alcanzó el límite de envío de Meta para este número. Intente de nuevo en unos ' +
      'instantes.',
    noReason:
      'WhatsApp Oficial rechazó el envío y no informó el motivo. ' +
      'Revise la conexión de la línea e intente de nuevo.',
    generic: (code, raw) =>
      `WhatsApp Oficial rechazó el envío${code ? ` (error ${code})` : ''}. Respuesta del proveedor: ` +
      raw,
  }),
}

export function deliveryFailureNotices(
  locale: NoticeLocale,
): DeliveryFailureNotices {
  return NOTICES[locale]
}
