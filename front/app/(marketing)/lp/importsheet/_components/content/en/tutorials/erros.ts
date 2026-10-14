import type { ErrosCopy } from '../../pt/tutorials/erros'

export const ERROS_EN: ErrosCopy = {
  tutorial: {
    slug: 'erros',
    label: 'Errors and reprocessing',
    summary:
      'See the rejected rows, reprocess them after fixing and choose who gets notified.',
    steps: [
      {
        screen: 'list',
        title: 'Open the import errors',
        description:
          'When a run completes with errors, the import gets a yellow dot and the View errors button.',
        action: 'View errors',
      },
      {
        screen: 'errors',
        title: 'Fix and reprocess',
        description:
          'Each rejected row shows up with the reason (up to 50 per run). Fix the spreadsheet or Bitrix24 and click Reprocess — or Reprocess all.',
        action: 'Reprocess',
      },
      {
        screen: 'notify',
        title: 'Choose who is notified',
        description:
          'In Settings, on the Error notifications card, tick the Bitrix24 users who should be told when an import has errors.',
        action: 'Select Ana Souza',
      },
      {
        screen: 'save',
        title: 'Save the recipients',
        description: 'The chosen users show up under Recipients. Click Save.',
        action: 'Save',
      },
    ],
    done: {
      title: 'Notifications set',
      description:
        'Recipients get a Bitrix24 notification when an import has errors — at most one every 6 hours per import.',
    },
  },
  screens: {
    modal: {
      title: 'Import completed with errors',
      description:
        'The rows below were rejected. Fix the spreadsheet and reprocess.',
      row: (row: number) => `Row ${row}`,
      reprocess: 'Reprocess',
      reprocessAll: 'Reprocess all',
      close: 'Close',
    },
    errorRows: [
      {
        row: 14,
        message: 'Ambiguous match: the identifier matched more than one record',
      },
      { row: 27, message: 'Required field is empty: Name' },
    ],
    users: ['Ana Souza', 'Bruno Lima', 'Carla Mendes', 'Diego Rocha'],
  },
}
