import type { NoticeLocale } from './notice-locale'

/**
 * Comentários que o servidor publica na timeline do CRM, por idioma.
 *
 * Destinatário, mensagem, nome de template, telefones e erros de validação entram como
 * dado e aparecem como vieram. O pt é o texto que já existia.
 */
export type TimelineNotices = {
  widgetFailed: (destination: string, text: string) => string
  widgetUnknown: (destination: string, text: string) => string
  /** Confirmação do envio pela fila. A linha `Template:` é a mesma nos três idiomas. */
  widgetSentQueued: (input: {
    destination: string
    templateName?: string
    text: string
  }) => string
  /** Confirmação do envio síncrono (com anexo). */
  widgetSentSync: (input: {
    fromPhone: string
    destination: string
    text: string
  }) => string
  sendRobot: {
    /** Telefone de origem que não pôde ser lido. */
    unknownPhone: string
    noRecipients: (fromPhone: string) => string
    result: (input: {
      fromPhone: string
      sent: string[]
      message: string
    }) => string
  }
  buttonRobot: {
    incomplete: string
    lineCannotSend: (error: string) => string
    providerMismatch: (actual: string, expected: string) => string
    noRecipients: string
    noValidRecipients: string
    queued: (destinations: string[]) => string
  }
  templateRobot: {
    incomplete: string
    lineCannotSend: (error: string) => string
    noRecipients: string
    noValidRecipients: string
    queued: (input: {
      templateName: string
      language: string
      destinations: string[]
    }) => string
  }
}

const NOTICES: Record<NoticeLocale, TimelineNotices> = {
  pt: {
    widgetFailed: (destination, text) =>
      '⚠️ A mensagem abaixo NÃO foi entregue e não será reenviada automaticamente.\n' +
      `Para: ${destination}\n` +
      `Mensagem: ${text}\n` +
      'Confira a conexão da linha e envie novamente pelo widget.',
    widgetUnknown: (destination, text) =>
      '⚠️ Não foi possível confirmar se a mensagem abaixo saiu.\n' +
      `Para: ${destination}\n` +
      `Mensagem: ${text}\n` +
      'Confira a conversa com o contato ANTES de reenviar — ela pode ter sido entregue.',
    widgetSentQueued: ({ destination, templateName, text }) =>
      `Para: ${destination}` +
      (templateName !== undefined ? `\nTemplate: ${templateName}` : '') +
      `\nMensagem: ${text}`,
    widgetSentSync: ({ fromPhone, destination, text }) =>
      `De: ${fromPhone}\nPara: ${destination}\nMensagem: ${text}`,
    sendRobot: {
      unknownPhone: 'desconhecido',
      noRecipients: fromPhone =>
        `De: ${fromPhone}\nNenhum destinatário encontrado para o envio.`,
      result: ({ fromPhone, sent, message }) =>
        `De: ${fromPhone}\nPara: ${sent.join(', ')}\nMensagem: ${message}`,
    },
    buttonRobot: {
      incomplete:
        'A automação está sem linha, sem corpo ou sem nenhum botão configurado. Abra a configuração do robô e preencha os três.',
      lineCannotSend: error =>
        `A linha configurada não pode enviar botões: ${error}`,
      providerMismatch: (actual, expected) =>
        `A linha configurada é ${actual}, mas este robô só dispara para linha ${expected}.`,
      noRecipients:
        'Nenhum destinatário encontrado para o envio da mensagem com botões.',
      noValidRecipients:
        'Nenhum destinatário válido para o envio da mensagem com botões.',
      queued: destinations =>
        `Mensagem com botões enfileirada para: ${destinations.join(', ')}`,
    },
    templateRobot: {
      incomplete:
        'A automação está sem linha ou sem template escolhido. Abra a configuração do robô e escolha os dois.',
      lineCannotSend: error =>
        `A linha configurada não pode enviar template: ${error}`,
      noRecipients: 'Nenhum destinatário encontrado para o envio do template.',
      noValidRecipients: 'Nenhum destinatário válido para o envio do template.',
      queued: ({ templateName, language, destinations }) =>
        `Template "${templateName}" (${language}) enfileirado para: ${destinations.join(', ')}`,
    },
  },
  en: {
    widgetFailed: (destination, text) =>
      '⚠️ The message below was NOT delivered and will not be resent automatically.\n' +
      `To: ${destination}\n` +
      `Message: ${text}\n` +
      'Check the line connection and send it again from the widget.',
    widgetUnknown: (destination, text) =>
      '⚠️ It was not possible to confirm whether the message below was sent.\n' +
      `To: ${destination}\n` +
      `Message: ${text}\n` +
      'Check the conversation with the contact BEFORE resending — it may have been delivered.',
    widgetSentQueued: ({ destination, templateName, text }) =>
      `To: ${destination}` +
      (templateName !== undefined ? `\nTemplate: ${templateName}` : '') +
      `\nMessage: ${text}`,
    widgetSentSync: ({ fromPhone, destination, text }) =>
      `From: ${fromPhone}\nTo: ${destination}\nMessage: ${text}`,
    sendRobot: {
      unknownPhone: 'unknown',
      noRecipients: fromPhone =>
        `From: ${fromPhone}\nNo recipients found for this send.`,
      result: ({ fromPhone, sent, message }) =>
        `From: ${fromPhone}\nTo: ${sent.join(', ')}\nMessage: ${message}`,
    },
    buttonRobot: {
      incomplete:
        'The automation has no line, no body or no button configured. Open the robot settings and fill in all three.',
      lineCannotSend: error =>
        `The configured line cannot send buttons: ${error}`,
      providerMismatch: (actual, expected) =>
        `The configured line is ${actual}, but this robot only runs for ${expected} lines.`,
      noRecipients: 'No recipients found for the button message.',
      noValidRecipients: 'No valid recipients for the button message.',
      queued: destinations =>
        `Button message queued for: ${destinations.join(', ')}`,
    },
    templateRobot: {
      incomplete:
        'The automation has no line or no template selected. Open the robot settings and choose both.',
      lineCannotSend: error =>
        `The configured line cannot send templates: ${error}`,
      noRecipients: 'No recipients found for the template.',
      noValidRecipients: 'No valid recipients for the template.',
      queued: ({ templateName, language, destinations }) =>
        `Template "${templateName}" (${language}) queued for: ${destinations.join(', ')}`,
    },
  },
  es: {
    widgetFailed: (destination, text) =>
      '⚠️ El mensaje de abajo NO fue entregado y no se reenviará automáticamente.\n' +
      `Para: ${destination}\n` +
      `Mensaje: ${text}\n` +
      'Revise la conexión de la línea y envíelo de nuevo desde el widget.',
    widgetUnknown: (destination, text) =>
      '⚠️ No fue posible confirmar si el mensaje de abajo salió.\n' +
      `Para: ${destination}\n` +
      `Mensaje: ${text}\n` +
      'Revise la conversación con el contacto ANTES de reenviar — puede haber sido entregado.',
    widgetSentQueued: ({ destination, templateName, text }) =>
      `Para: ${destination}` +
      (templateName !== undefined ? `\nTemplate: ${templateName}` : '') +
      `\nMensaje: ${text}`,
    widgetSentSync: ({ fromPhone, destination, text }) =>
      `De: ${fromPhone}\nPara: ${destination}\nMensaje: ${text}`,
    sendRobot: {
      unknownPhone: 'desconocido',
      noRecipients: fromPhone =>
        `De: ${fromPhone}\nNo se encontró ningún destinatario para el envío.`,
      result: ({ fromPhone, sent, message }) =>
        `De: ${fromPhone}\nPara: ${sent.join(', ')}\nMensaje: ${message}`,
    },
    buttonRobot: {
      incomplete:
        'La automatización no tiene línea, cuerpo ni ningún botón configurado. Abra la configuración del robot y complete los tres.',
      lineCannotSend: error =>
        `La línea configurada no puede enviar botones: ${error}`,
      providerMismatch: (actual, expected) =>
        `La línea configurada es ${actual}, pero este robot solo funciona con líneas ${expected}.`,
      noRecipients:
        'No se encontró ningún destinatario para el mensaje con botones.',
      noValidRecipients:
        'No hay destinatarios válidos para el mensaje con botones.',
      queued: destinations =>
        `Mensaje con botones en cola para: ${destinations.join(', ')}`,
    },
    templateRobot: {
      incomplete:
        'La automatización no tiene línea ni plantilla elegida. Abra la configuración del robot y elija las dos.',
      lineCannotSend: error =>
        `La línea configurada no puede enviar plantillas: ${error}`,
      noRecipients: 'No se encontró ningún destinatario para la plantilla.',
      noValidRecipients: 'No hay destinatarios válidos para la plantilla.',
      queued: ({ templateName, language, destinations }) =>
        `Plantilla "${templateName}" (${language}) en cola para: ${destinations.join(', ')}`,
    },
  },
}

export function timelineNotices(locale: NoticeLocale): TimelineNotices {
  return NOTICES[locale]
}
