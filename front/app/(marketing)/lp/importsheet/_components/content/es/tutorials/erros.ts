import type { ErrosCopy } from '../../pt/tutorials/erros'

export const ERROS_ES: ErrosCopy = {
  tutorial: {
    slug: 'erros',
    label: 'Errores y reprocesamiento',
    summary:
      'Vea las filas rechazadas, reprocéselas después de corregir y elija quién recibe el aviso.',
    steps: [
      {
        screen: 'list',
        title: 'Abra los errores de la importación',
        description:
          'Cuando una ronda se completa con errores, la importación muestra un punto amarillo y el botón Ver errores.',
        action: 'Ver errores',
      },
      {
        screen: 'errors',
        title: 'Corrija y reprocese',
        description:
          'Cada fila rechazada aparece con el motivo (hasta 50 por ronda). Corrija la hoja o Bitrix24 y haga clic en Reprocesar — o en Reprocesar todas.',
        action: 'Reprocesar',
      },
      {
        screen: 'notify',
        title: 'Elija a quién se avisa',
        description:
          'En Configuración, en la tarjeta Notificaciones de error, marque los usuarios de Bitrix24 que deben recibir un aviso cuando una importación tenga errores.',
        action: 'Seleccionar a Ana Souza',
      },
      {
        screen: 'save',
        title: 'Guarde los destinatarios',
        description:
          'Los elegidos aparecen en Destinatarios. Haga clic en Guardar.',
        action: 'Guardar',
      },
    ],
    done: {
      title: 'Avisos configurados',
      description:
        'Los destinatarios reciben una notificación en Bitrix24 cuando una importación tiene errores — como máximo una cada 6 horas por importación.',
    },
  },
  screens: {
    modal: {
      title: 'Importación completada con errores',
      description:
        'Las filas a continuación fueron rechazadas. Corrija la hoja y reprocese.',
      row: (row: number) => `Fila ${row}`,
      reprocess: 'Reprocesar',
      reprocessAll: 'Reprocesar todas',
      close: 'Cerrar',
    },
    errorRows: [
      {
        row: 14,
        message:
          'Coincidencia ambigua: el identificador coincidió con más de un registro',
      },
      { row: 27, message: 'Campo obligatorio sin completar: Nombre' },
    ],
    users: ['Ana Souza', 'Bruno Lima', 'Carla Mendes', 'Diego Rocha'],
  },
}
