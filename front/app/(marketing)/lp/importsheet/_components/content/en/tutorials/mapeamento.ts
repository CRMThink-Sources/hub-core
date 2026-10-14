import type { MapeamentoCopy } from '../../pt/tutorials/mapeamento'

export const MAPEAMENTO_EN: MapeamentoCopy = {
  tutorial: {
    slug: 'mapeamento',
    label: 'Set up and map',
    summary:
      'Bitrix24 destination, owner, column mapping and the identifier that prevents duplicates.',
    steps: [
      {
        screen: 'identity',
        title: 'Name it and check the tab',
        description:
          'Name the import and check the tab. Row 1 of the tab must hold the column titles; the data starts at "Import from row" (2 by default).',
        action: 'Import from row',
      },
      {
        screen: 'entity',
        title: 'Choose the destination entity',
        description:
          'Lead, Deal, Contact, Company, SPA, Tasks or Livefeed. Deal asks for the pipeline; SPA asks for the type and then the pipeline. Livefeed posts a comment on the timeline of an existing record.',
        action: 'Deal',
      },
      {
        screen: 'responsible',
        title: 'Set the owner',
        description:
          'Point to the column with the owner of each row and how to find them: ID, email or phone of an active Bitrix24 user.',
        action: 'Owner identified by',
      },
      {
        screen: 'options',
        title: 'Create the contact and company too',
        description:
          'Turn on Create contact and/or Create company so the same row also creates the contact and company linked to the record.',
        action: 'Create contact',
      },
      {
        screen: 'mapping',
        title: 'Link each column to a field',
        description:
          'For each column, choose the destination (the main record, the contact or the company) and the Bitrix24 field. Tags show the field type: list, date, Y/N, $. Every column needs a field — remove the ones you do not need with the trash icon.',
        action: 'Contact',
      },
      {
        screen: 'identifier',
        title: 'Mark the identifier',
        description:
          'Tick the column that identifies the record (a code, email or document). If 1 record has that value, it is updated; if none, it is created; if more than one, the row is left out and shows up in the errors.',
        action: 'Use as identifier',
      },
      {
        screen: 'save',
        title: 'Save the import',
        description:
          'With everything mapped, click Save. The import shows up in the list.',
        action: 'Save',
      },
    ],
    done: {
      title: 'Import set up',
      description:
        'Destination, owner and mapping saved. All that is left is deciding when it runs.',
    },
  },
  screens: {},
}
