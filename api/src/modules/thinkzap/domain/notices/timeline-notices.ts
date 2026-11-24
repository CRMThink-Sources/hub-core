import type { NoticeLocale } from './notice-locale'
import { bbField, bbLines, bbQuote, bbTitle } from './timeline-format'

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
  /** Linha que identifica o remetente quando o comentário sai com a credencial da instalação. */
  sentBy: (name: string) => string
  sendRobot: {
    /** Telefone de origem que não pôde ser lido. */
    unknownPhone: string
    noRecipients: (fromPhone: string) => string
    /** Disparo sem mensagem e sem arquivo. */
    noContent: string
    /** Sem `files`, o texto é o de antes desta mudança. */
    result: (input: {
      fromPhone: string
      sent: string[]
      message: string
      files?: SendRobotFilesResult
    }) => string
  }
  buttonRobot: {
    incomplete: string
    lineCannotSend: (error: string) => string
    providerMismatch: (actual: string, expected: string) => string
    noRecipients: string
    noValidRecipients: string
    /** O destino chegou vazio (`{}`): o campo escolhido veio sem valor. */
    destinationEmpty: string
    /** O Bitrix não resolveu o campo e entregou o texto cru no lugar do telefone. */
    destinationUnresolved: (value: string) => string
    queued: (destinations: string[]) => string
  }
  templateRobot: {
    incomplete: string
    /** Template com botão dinâmico e robô sem valor para algum deles. */
    missingButtonValues: string
    /** Template com imagem no cabeçalho e robô sem URL `https` para ela. */
    missingHeaderImage: string
    lineCannotSend: (error: string) => string
    noRecipients: string
    noValidRecipients: string
    /** O destino chegou vazio (`{}`): o campo escolhido veio sem valor. */
    destinationEmpty: string
    /** O Bitrix não resolveu o campo e entregou o texto cru no lugar do telefone. */
    destinationUnresolved: (value: string) => string
    queued: (input: {
      templateName: string
      language: string
      destinations: string[]
    }) => string
  }
}

/** Por que um arquivo do robô não saiu. */
export type SendRobotFileFailure = 'unavailable' | 'too_large' | 'send_failed'

export type SendRobotFilesResult = {
  /** Arquivos aceitos pelo provider para pelo menos um destinatário. */
  sent: string[]
  failed: { name: string; reason: SendRobotFileFailure }[]
}

type SendRobotFileLabels = {
  message: string
  sentFiles: string
  failedFiles: string
  reasons: Record<SendRobotFileFailure, string>
}

/**
 * Rótulos e frases fixas do layout, por idioma. A estrutura é a mesma nos três: título
 * em negrito, campos rotulados, a mensagem em citação e a orientação ao fim.
 * `template` é literal em todos: é por essa linha que o cliente concilia a cobrança.
 */
type Labels = {
  from: string
  to: string
  message: string
  template: string
  sentTitle: string
  failedTitle: string
  failedNotice: string
  failedAction: string
  unknownTitle: string
  unknownNotice: string
  unknownAction: string
  robotTitle: string
  robotNoRecipientsTitle: string
  buttonQueuedTitle: string
  templateQueuedTitle: string
  sentBy: string
  file: SendRobotFileLabels
}

function widgetSent(
  l: Labels,
  input: {
    fromPhone?: string
    destination: string
    templateName?: string
    text: string
  },
): string {
  return bbLines([
    bbTitle(l.sentTitle),
    input.fromPhone !== undefined
      ? bbField(l.from, input.fromPhone)
      : undefined,
    bbField(l.to, input.destination),
    input.templateName !== undefined
      ? bbField(l.template, input.templateName)
      : undefined,
    bbQuote(input.text),
  ])
}

function widgetNotDelivered(
  l: Labels,
  kind: 'failed' | 'unknown',
  destination: string,
  text: string,
): string {
  const failed = kind === 'failed'
  return bbLines([
    bbTitle(failed ? l.failedTitle : l.unknownTitle),
    failed ? l.failedNotice : l.unknownNotice,
    bbField(l.to, destination),
    bbQuote(text),
    failed ? l.failedAction : l.unknownAction,
  ])
}

function sendRobotResult(
  l: Labels,
  fromPhone: string,
  sent: string[],
  input: { message: string; files?: SendRobotFilesResult },
): string {
  const lines: (string | undefined)[] = [
    bbTitle(l.robotTitle),
    bbField(l.from, fromPhone),
    bbField(l.to, sent.join(', ')),
  ]
  // Sem `files`, a mensagem aparece sempre; com `files`, só quando existe.
  if (!input.files || input.message) lines.push(bbQuote(input.message))
  if (input.files) {
    if (input.files.sent.length > 0) {
      lines.push(bbField(l.file.sentFiles, input.files.sent.join(', ')))
    }
    if (input.files.failed.length > 0) {
      const failed = input.files.failed
        .map(f => `${f.name} (${l.file.reasons[f.reason]})`)
        .join(', ')
      lines.push(bbField(l.file.failedFiles, failed))
    }
  }
  return bbLines(lines)
}

/**
 * Destino que o Bitrix entregou ao robô sem virar telefone. Igual nos robôs de template
 * e de botões: a causa e o conserto são os mesmos, só muda o que deixou de ser enviado.
 * O valor recebido entra como veio — é a pista de que o campo não foi resolvido.
 */
const DESTINATION_NOTICES: Record<
  NoticeLocale,
  { empty: string; unresolved: (value: string) => string }
> = {
  pt: {
    empty:
      'O destino do envio está vazio. Se o destino é um campo do contato (por exemplo "Contato: Celular"), o contato pode não ter telefone do tipo lido por esse campo: confira o tipo do telefone no cadastro. Se o destino não foi configurado, abra a configuração do robô e informe-o. Nada foi enviado.',
    unresolved: value =>
      `O Bitrix não resolveu o campo escolhido como destino e entregou o texto "${value}" no lugar do telefone. Abra a configuração do robô, escolha o campo de novo em "Campo da entidade" e salve a automação. Nada foi enviado.`,
  },
  en: {
    empty:
      'The send destination is empty. If the destination is a contact field (for example "Contact: Mobile"), the contact may not have a phone of the type that field reads: check the phone type in the contact record. If no destination was set, open the robot settings and fill it in. Nothing was sent.',
    unresolved: value =>
      `Bitrix did not resolve the field chosen as the destination and delivered the text "${value}" instead of a phone number. Open the robot settings, choose the field again under "Entity field" and save the automation. Nothing was sent.`,
  },
  es: {
    empty:
      'El destino del envío está vacío. Si el destino es un campo del contacto (por ejemplo "Contacto: Celular"), es posible que el contacto no tenga un teléfono del tipo que lee ese campo: revise el tipo de teléfono en la ficha. Si no se configuró un destino, abra la configuración del robot e indíquelo. No se envió nada.',
    unresolved: value =>
      `Bitrix no resolvió el campo elegido como destino y entregó el texto "${value}" en lugar de un teléfono. Abra la configuración del robot, elija el campo de nuevo en "Campo de la entidad" y guarde la automatización. No se envió nada.`,
  },
}

const LABELS: Record<NoticeLocale, Labels> = {
  pt: {
    from: 'De',
    to: 'Para',
    message: 'Mensagem',
    template: 'Template',
    sentTitle: '✅ Mensagem enviada',
    failedTitle: '⚠️ Falha no envio',
    failedNotice:
      'A mensagem abaixo NÃO foi entregue e não será reenviada automaticamente.',
    failedAction: 'Confira a conexão da linha e envie novamente pelo widget.',
    unknownTitle: '⚠️ Envio sem confirmação',
    unknownNotice: 'Não foi possível confirmar se a mensagem abaixo saiu.',
    unknownAction:
      'Confira a conversa com o contato ANTES de reenviar — ela pode ter sido entregue.',
    robotTitle: '✅ Mensagem enviada pelo robô',
    robotNoRecipientsTitle: '⚠️ Robô sem destinatário',
    buttonQueuedTitle: '✅ Mensagem com botões enfileirada',
    templateQueuedTitle: '✅ Template enfileirado',
    sentBy: 'Enviado por',
    file: {
      message: 'Mensagem',
      sentFiles: 'Arquivos enviados',
      failedFiles: 'Arquivos não enviados',
      reasons: {
        unavailable: 'não foi possível obter o arquivo',
        too_large: 'maior que 30 MB',
        send_failed: 'falha no envio',
      },
    },
  },
  en: {
    from: 'From',
    to: 'To',
    message: 'Message',
    template: 'Template',
    sentTitle: '✅ Message sent',
    failedTitle: '⚠️ Send failed',
    failedNotice:
      'The message below was NOT delivered and will not be resent automatically.',
    failedAction:
      'Check the line connection and send it again from the widget.',
    unknownTitle: '⚠️ Send not confirmed',
    unknownNotice:
      'It was not possible to confirm whether the message below was sent.',
    unknownAction:
      'Check the conversation with the contact BEFORE resending — it may have been delivered.',
    robotTitle: '✅ Message sent by the robot',
    robotNoRecipientsTitle: '⚠️ Robot with no recipient',
    buttonQueuedTitle: '✅ Button message queued',
    templateQueuedTitle: '✅ Template queued',
    sentBy: 'Sent by',
    file: {
      message: 'Message',
      sentFiles: 'Files sent',
      failedFiles: 'Files not sent',
      reasons: {
        unavailable: 'could not get the file',
        too_large: 'larger than 30 MB',
        send_failed: 'send failed',
      },
    },
  },
  es: {
    from: 'De',
    to: 'Para',
    message: 'Mensaje',
    template: 'Template',
    sentTitle: '✅ Mensaje enviado',
    failedTitle: '⚠️ Falla en el envío',
    failedNotice:
      'El mensaje de abajo NO fue entregado y no se reenviará automáticamente.',
    failedAction:
      'Revise la conexión de la línea y envíelo de nuevo desde el widget.',
    unknownTitle: '⚠️ Envío sin confirmación',
    unknownNotice: 'No fue posible confirmar si el mensaje de abajo salió.',
    unknownAction:
      'Revise la conversación con el contacto ANTES de reenviar — puede haber sido entregado.',
    robotTitle: '✅ Mensaje enviado por el robot',
    robotNoRecipientsTitle: '⚠️ Robot sin destinatario',
    buttonQueuedTitle: '✅ Mensaje con botones en cola',
    templateQueuedTitle: '✅ Plantilla en cola',
    sentBy: 'Enviado por',
    file: {
      message: 'Mensaje',
      sentFiles: 'Archivos enviados',
      failedFiles: 'Archivos no enviados',
      reasons: {
        unavailable: 'no fue posible obtener el archivo',
        too_large: 'mayor que 30 MB',
        send_failed: 'falla en el envío',
      },
    },
  },
}

const NOTICES: Record<NoticeLocale, TimelineNotices> = {
  pt: {
    widgetFailed: (destination, text) =>
      widgetNotDelivered(LABELS.pt, 'failed', destination, text),
    widgetUnknown: (destination, text) =>
      widgetNotDelivered(LABELS.pt, 'unknown', destination, text),
    widgetSentQueued: input => widgetSent(LABELS.pt, input),
    widgetSentSync: input => widgetSent(LABELS.pt, input),
    sentBy: name => bbField(LABELS.pt.sentBy, name),
    sendRobot: {
      unknownPhone: 'desconhecido',
      noRecipients: fromPhone =>
        bbLines([
          bbTitle(LABELS.pt.robotNoRecipientsTitle),
          bbField(LABELS.pt.from, fromPhone),
          `Nenhum destinatário encontrado para o envio.`,
        ]),
      noContent:
        'A automação não tem mensagem nem arquivo para enviar. Abra a configuração do robô e preencha a mensagem ou o arquivo.',
      result: ({ fromPhone, sent, ...rest }) =>
        sendRobotResult(LABELS.pt, fromPhone, sent, rest),
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
      destinationEmpty: DESTINATION_NOTICES.pt.empty,
      destinationUnresolved: DESTINATION_NOTICES.pt.unresolved,
      queued: destinations =>
        bbLines([
          bbTitle(LABELS.pt.buttonQueuedTitle),
          bbField(LABELS.pt.to, destinations.join(', ')),
        ]),
    },
    templateRobot: {
      incomplete:
        'A automação está sem linha ou sem template escolhido. Abra a configuração do robô e escolha os dois.',
      missingButtonValues:
        'O template escolhido tem botões que precisam de valor (link ou código), e a automação não informou todos. Abra a configuração do robô e preencha os botões.',
      missingHeaderImage:
        'O template escolhido exige uma imagem no cabeçalho, e não há imagem para enviar: a automação não informou uma URL https e o template não tem imagem padrão do envio. Nada foi enviado. Confira o campo da imagem na configuração do robô, ou defina a imagem padrão na aba de templates da linha.',
      lineCannotSend: error =>
        `A linha configurada não pode enviar template: ${error}`,
      noRecipients: 'Nenhum destinatário encontrado para o envio do template.',
      noValidRecipients: 'Nenhum destinatário válido para o envio do template.',
      destinationEmpty: DESTINATION_NOTICES.pt.empty,
      destinationUnresolved: DESTINATION_NOTICES.pt.unresolved,
      queued: ({ templateName, language, destinations }) =>
        bbLines([
          bbTitle(LABELS.pt.templateQueuedTitle),
          bbField(LABELS.pt.template, `${templateName} (${language})`),
          bbField(LABELS.pt.to, destinations.join(', ')),
        ]),
    },
  },
  en: {
    widgetFailed: (destination, text) =>
      widgetNotDelivered(LABELS.en, 'failed', destination, text),
    widgetUnknown: (destination, text) =>
      widgetNotDelivered(LABELS.en, 'unknown', destination, text),
    widgetSentQueued: input => widgetSent(LABELS.en, input),
    widgetSentSync: input => widgetSent(LABELS.en, input),
    sentBy: name => bbField(LABELS.en.sentBy, name),
    sendRobot: {
      unknownPhone: 'unknown',
      noRecipients: fromPhone =>
        bbLines([
          bbTitle(LABELS.en.robotNoRecipientsTitle),
          bbField(LABELS.en.from, fromPhone),
          `No recipients found for this send.`,
        ]),
      noContent:
        'The automation has no message and no file to send. Open the robot settings and fill in the message or the file.',
      result: ({ fromPhone, sent, ...rest }) =>
        sendRobotResult(LABELS.en, fromPhone, sent, rest),
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
      destinationEmpty: DESTINATION_NOTICES.en.empty,
      destinationUnresolved: DESTINATION_NOTICES.en.unresolved,
      queued: destinations =>
        bbLines([
          bbTitle(LABELS.en.buttonQueuedTitle),
          bbField(LABELS.en.to, destinations.join(', ')),
        ]),
    },
    templateRobot: {
      incomplete:
        'The automation has no line or no template selected. Open the robot settings and choose both.',
      missingButtonValues:
        'The selected template has buttons that need a value (link or code), and the automation did not provide all of them. Open the robot settings and fill in the buttons.',
      missingHeaderImage:
        'The selected template requires a header image, and there is no image to send: the automation did not provide an https URL and the template has no default sending image. Nothing was sent. Check the image field in the robot settings, or set the default image in the line templates tab.',
      lineCannotSend: error =>
        `The configured line cannot send templates: ${error}`,
      noRecipients: 'No recipients found for the template.',
      noValidRecipients: 'No valid recipients for the template.',
      destinationEmpty: DESTINATION_NOTICES.en.empty,
      destinationUnresolved: DESTINATION_NOTICES.en.unresolved,
      queued: ({ templateName, language, destinations }) =>
        bbLines([
          bbTitle(LABELS.en.templateQueuedTitle),
          bbField(LABELS.en.template, `${templateName} (${language})`),
          bbField(LABELS.en.to, destinations.join(', ')),
        ]),
    },
  },
  es: {
    widgetFailed: (destination, text) =>
      widgetNotDelivered(LABELS.es, 'failed', destination, text),
    widgetUnknown: (destination, text) =>
      widgetNotDelivered(LABELS.es, 'unknown', destination, text),
    widgetSentQueued: input => widgetSent(LABELS.es, input),
    widgetSentSync: input => widgetSent(LABELS.es, input),
    sentBy: name => bbField(LABELS.es.sentBy, name),
    sendRobot: {
      unknownPhone: 'desconocido',
      noRecipients: fromPhone =>
        bbLines([
          bbTitle(LABELS.es.robotNoRecipientsTitle),
          bbField(LABELS.es.from, fromPhone),
          `No se encontró ningún destinatario para el envío.`,
        ]),
      noContent:
        'La automatización no tiene mensaje ni archivo para enviar. Abra la configuración del robot y complete el mensaje o el archivo.',
      result: ({ fromPhone, sent, ...rest }) =>
        sendRobotResult(LABELS.es, fromPhone, sent, rest),
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
      destinationEmpty: DESTINATION_NOTICES.es.empty,
      destinationUnresolved: DESTINATION_NOTICES.es.unresolved,
      queued: destinations =>
        bbLines([
          bbTitle(LABELS.es.buttonQueuedTitle),
          bbField(LABELS.es.to, destinations.join(', ')),
        ]),
    },
    templateRobot: {
      incomplete:
        'La automatización no tiene línea ni plantilla elegida. Abra la configuración del robot y elija las dos.',
      missingButtonValues:
        'La plantilla elegida tiene botones que necesitan un valor (enlace o código), y la automatización no los informó todos. Abra la configuración del robot y complete los botones.',
      missingHeaderImage:
        'La plantilla elegida exige una imagen en el encabezado, y no hay imagen para enviar: la automatización no informó una URL https y la plantilla no tiene imagen predeterminada de envío. No se envió nada. Revise el campo de la imagen en la configuración del robot, o defina la imagen predeterminada en la pestaña de plantillas de la línea.',
      lineCannotSend: error =>
        `La línea configurada no puede enviar plantillas: ${error}`,
      noRecipients: 'No se encontró ningún destinatario para la plantilla.',
      noValidRecipients: 'No hay destinatarios válidos para la plantilla.',
      destinationEmpty: DESTINATION_NOTICES.es.empty,
      destinationUnresolved: DESTINATION_NOTICES.es.unresolved,
      queued: ({ templateName, language, destinations }) =>
        bbLines([
          bbTitle(LABELS.es.templateQueuedTitle),
          bbField(LABELS.es.template, `${templateName} (${language})`),
          bbField(LABELS.es.to, destinations.join(', ')),
        ]),
    },
  },
}

export function timelineNotices(locale: NoticeLocale): TimelineNotices {
  return NOTICES[locale]
}
