import type { NovaImportacaoCopy } from '../../pt/tutorials/nova-importacao'

export const NOVA_IMPORTACAO_EN: NovaImportacaoCopy = {
  tutorial: {
    slug: 'nova-importacao',
    label: 'New import',
    summary: 'Pick the Google spreadsheet and the tab that goes to Bitrix24.',
    steps: [
      {
        screen: 'empty',
        title: 'Start an import',
        description: 'In Imports, click New import.',
        action: 'New import',
      },
      {
        screen: 'paste',
        title: 'Paste the spreadsheet link',
        description:
          'Paste the whole spreadsheet link or just the ID — the part between /d/ and /edit in docs.google.com/spreadsheets/d/…. Then click Validate.',
        action: 'Validate',
      },
      {
        screen: 'tabs',
        title: 'Select the tab',
        description:
          'Once the spreadsheet is validated, its tabs show up with the row and column count of each one. Pick the one with the data.',
        action: 'Select the tab',
      },
      {
        screen: 'selected',
        title: 'Continue to the setup',
        description:
          'With the tab chosen, click Continue to set the Bitrix24 destination and the column mapping.',
        action: 'Continue',
      },
    ],
    done: {
      title: 'Spreadsheet validated',
      description:
        'If validation fails, check the link and whether the spreadsheet is shared with the email of the connected Google account.',
    },
  },
  screens: {
    modal: {
      title: 'New import',
      description: 'Enter the Google spreadsheet ID (or link)',
      idLabel: 'Spreadsheet ID',
      placeholder: 'e.g.: 1AbC…XyZ or the spreadsheet URL',
      validate: 'Validate',
      urlHint: 'The ID is in the URL:',
      selectTab: 'Select the tab',
      rowsCols: (rows: number, cols: number) =>
        `${rows} rows · ${cols} columns`,
      cancel: 'Cancel',
      proceed: 'Continue',
    },
    pastedUrl: 'https://docs.google.com/spreadsheets/d/1AbC9xZ…/edit',
    tabs: [
      { title: 'Orders', rows: 1250, cols: 6 },
      { title: '2025 archive', rows: 830, cols: 6 },
    ],
  },
}
