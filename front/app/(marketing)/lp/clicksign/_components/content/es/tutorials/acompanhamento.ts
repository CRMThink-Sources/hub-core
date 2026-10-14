import type { AcompanhamentoCopy } from '../../pt/tutorials/acompanhamento'

export const ACOMPANHAMENTO_ES: AcompanhamentoCopy = {
  tutorial: {
    slug: 'acompanhamento',
    label: 'Seguir y cancelar',
    summary:
      'Todo vuelve a la línea de tiempo de la negociación: quién ya firmó, el PDF firmado, rechazos y cancelaciones.',
    steps: [
      {
        screen: 'sent',
        title: 'Sigue el proceso en la tarjeta',
        description:
          'En la línea de tiempo de la negociación aparece la tarjeta [Clicksign] con el documento y el grupo, la etiqueta En curso y cada persona que firma como Pendiente.',
        action: 'En curso',
      },
      {
        screen: 'signed',
        title: 'Mira quién ya firmó',
        description: 'Con cada firma, la fila de la persona pasa a Firmado.',
        action: 'Firmado',
      },
      {
        screen: 'finished',
        title: 'Recibe el documento firmado',
        description:
          'Cuando todos firman, la tarjeta queda Finalizado y el PDF firmado se adjunta en Archivo Firmado (hasta 25 MB). Se completan Estado de Firma, Fecha de Firma y Proceso Finalizado. La negociación no cambia de etapa sola: si quieres, crea tu propia automatización a partir de esos campos.',
        action: 'Archivo Firmado',
      },
      {
        screen: 'refused',
        title: 'Si alguien rechaza',
        description:
          'Si el robot permite el rechazo, la línea de tiempo muestra Documento rechazado, con quién lo rechazó y el motivo, y la tarjeta queda Rechazado.',
        action: 'Documento rechazado',
      },
      {
        screen: 'cancel',
        title: 'Cancela desde la tarjeta',
        description:
          '¿Necesitas anular el envío? Haz clic en Cancelar documento en la tarjeta. Un documento ya finalizado ya no se puede cancelar.',
        action: 'Cancelar documento',
      },
      {
        screen: 'canceled',
        title: 'Cancelación registrada',
        description:
          'La tarjeta queda Cancelado y la línea de tiempo registra Cancelación de documento, con quién lo canceló y cuándo.',
        action: 'Cancelación de documento',
      },
      {
        screen: 'error',
        title: 'Si algo sale mal',
        description:
          'Cuando el envío no se realiza, la línea de tiempo recibe un comentario que empieza por [Clicksign] con el motivo — por ejemplo, Documento no adjuntado a la negociación. Corrígelo y vuelve a ejecutar el robot, sacando la negociación de la etapa y regresándola.',
        action: 'Comentario de Clicksign',
      },
    ],
    done: {
      title: 'Todo bajo control',
      description:
        'Del envío al PDF firmado, sin salir de Bitrix24. ¿Te quedó alguna duda? Mira las preguntas frecuentes abajo.',
    },
  },
  screens: {
    refusedLog: {
      title: '[Clicksign] Documento rechazado',
      by: (name, when) => `Rechazado por ${name} el ${when}`,
      reasons: 'Motivo(s): Datos incorrectos',
      comment: 'Descripción: La dirección del contrato está mal.',
    },
    canceledLog: {
      title: '[Clicksign] Cancelación de documento',
      by: (name, when) => `Cancelación realizada por ${name} el ${when}`,
    },
    errorComment: '[Clicksign] Documento no adjuntado a la negociación',
    when: '14/10/2026 10:32',
  },
}
