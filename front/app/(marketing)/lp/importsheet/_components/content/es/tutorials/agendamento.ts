import type { AgendamentoCopy } from '../../pt/tutorials/agendamento'

export const AGENDAMENTO_ES: AgendamentoCopy = {
  tutorial: {
    slug: 'agendamento',
    label: 'Programación',
    summary:
      'Deje que la importación se ejecute sola cada cierto tiempo, o solo cuando usted lo indique.',
    steps: [
      {
        screen: 'frequency',
        title: 'Elija la frecuencia',
        description:
          'En la sección Programación, elija Horas para ejecutar cada X horas, o Días de la semana para ejecutar en los días marcados, siempre a las 00:00 (hora de Brasilia).',
        action: 'Horas',
      },
      {
        screen: 'hours',
        title: 'Defina el intervalo y guarde',
        description:
          'En "Cada (horas)", ingrese de 1 a 23. ¿Prefiere ejecutarla solo cuando quiera? Active "Ejecutar importación manualmente". Luego, Guardar.',
        action: 'Guardar',
      },
      {
        screen: 'scheduled',
        title: 'Pause cuando lo necesite',
        description:
          'En la lista, la importación muestra la frecuencia y el interruptor de la programación. Desactívelo para pausar y vuelva a activarlo para reanudar.',
        action: 'Pausar programación',
      },
      {
        screen: 'manual-run',
        title: 'Ejecute una importación manual',
        description:
          'Las importaciones en modo manual tienen el botón Ejecutar en lugar del interruptor. Haga clic para ejecutarla ahora.',
        action: 'Ejecutar',
      },
      {
        screen: 'queued',
        title: 'Siga la ejecución',
        description:
          'La importación entra en la cola y la lista muestra En ejecución. Cada ronda lee solo las filas nuevas, a partir de donde terminó la anterior.',
        action: 'En ejecución',
      },
    ],
    done: {
      title: 'Programación lista',
      description:
        'Agregue filas al final de la hoja y llegarán a Bitrix24 en la siguiente ronda, sin repetir las que ya se importaron.',
    },
  },
  screens: {
    queuedToast: 'Importación en cola para ejecución.',
    everyHours: 6,
  },
}
