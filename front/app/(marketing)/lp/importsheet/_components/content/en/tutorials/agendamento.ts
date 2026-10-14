import type { AgendamentoCopy } from '../../pt/tutorials/agendamento'

export const AGENDAMENTO_EN: AgendamentoCopy = {
  tutorial: {
    slug: 'agendamento',
    label: 'Scheduling',
    summary:
      'Let the import run on its own every so often, or only when you say so.',
    steps: [
      {
        screen: 'frequency',
        title: 'Choose the frequency',
        description:
          'In the Schedule section, choose Hours to run every X hours, or Weekdays to run on the days you tick, always at 00:00 (Brasilia time).',
        action: 'Hours',
      },
      {
        screen: 'hours',
        title: 'Set the interval and save',
        description:
          'In "Every (hours)", enter 1 to 23. Rather run it only when you want? Turn on "Run import manually". Then click Save.',
        action: 'Save',
      },
      {
        screen: 'scheduled',
        title: 'Pause it when needed',
        description:
          'In the list, the import shows its frequency and the schedule switch. Turn it off to pause and on again to activate.',
        action: 'Pause schedule',
      },
      {
        screen: 'manual-run',
        title: 'Run a manual import',
        description:
          'Imports in manual mode have a Run button instead of the switch. Click it to run now.',
        action: 'Run',
      },
      {
        screen: 'queued',
        title: 'Follow the run',
        description:
          'The import is queued and the list shows Running. Each run reads only the new rows, starting where the previous one stopped.',
        action: 'Running',
      },
    ],
    done: {
      title: 'Schedule ready',
      description:
        'Add rows at the end of the spreadsheet and they reach Bitrix24 on the next run, without repeating the ones already imported.',
    },
  },
  screens: {
    queuedToast: 'Import queued for execution.',
    everyHours: 6,
  },
}
