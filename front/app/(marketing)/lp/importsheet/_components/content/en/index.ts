import type { LpContent } from '../types'
import { AGENDAMENTO_EN } from './tutorials/agendamento'
import { ERROS_EN } from './tutorials/erros'
import { GOOGLE_EN } from './tutorials/google'
import { INSTALACAO_EN } from './tutorials/instalacao'
import { MAPEAMENTO_EN } from './tutorials/mapeamento'
import { NOVA_IMPORTACAO_EN } from './tutorials/nova-importacao'

export const EN: LpContent = {
  locale: 'en',
  htmlLang: 'en',
  metadata: {
    title: 'ImportSheet — Google Sheets integrated with Bitrix24',
    description:
      'Import Google Sheets spreadsheets into Bitrix24: leads, deals, contacts, companies, SPAs, tasks and Livefeed, with column mapping, scheduling and no duplicate records.',
    ogLocale: 'en_US',
  },
  whatsappMessage:
    "Hi! I found the ImportSheet page and I'd like to know more about importing Google spreadsheets into Bitrix24.",
  nav: {
    features: 'Features',
    tutorials: 'Tutorials',
    faq: 'FAQ',
    install: 'Install',
  },
  languageSwitch: { label: 'Language' },
  hero: {
    eyebrow: 'Google Sheets inside Bitrix24',
    title: 'Your Google spreadsheet becomes CRM records, no copy and paste',
    subtitle:
      'ImportSheet reads the rows of your spreadsheet and creates or updates leads, deals, contacts, companies and SPAs in Bitrix24 — right away or on the schedule you set.',
  },
  sheetPreview: {
    columns: ['Order', 'Customer', 'Amount'],
    rows: [
      ['1042', 'Mary Clark', '$2,400'],
      ['1043', 'Paul Henry', '$980'],
      ['1044', 'Olivia Turner', '$5,150'],
    ],
    entity: 'Deals',
    created: 'created',
    updated: 'updated',
  },
  features: {
    title: 'From spreadsheet to CRM, without rework',
    subtitle: 'Set it up once and let new rows reach Bitrix24 on their own.',
    items: [
      {
        icon: 'sheets',
        title: 'Straight from Google Sheets',
        description:
          'Paste the spreadsheet link, pick the tab and you are done. ImportSheet only reads — your spreadsheet stays as it is.',
      },
      {
        icon: 'entities',
        title: 'Every CRM entity',
        description:
          'Leads, deals (with pipeline), contacts, companies, SPAs and tasks. Plus Livefeed comments on existing records.',
      },
      {
        icon: 'mapping',
        title: 'Column by column mapping',
        description:
          'Link each column to a Bitrix24 field, custom fields included, and create the contact and company from the same row.',
      },
      {
        icon: 'dedup',
        title: 'No duplicate records',
        description:
          'Mark a column as the identifier: if the record already exists, it is updated instead of duplicated.',
      },
      {
        icon: 'schedule',
        title: 'Scheduling',
        description:
          'Run every X hours, on chosen weekdays or only when you want, with one click.',
      },
      {
        icon: 'incremental',
        title: 'Only the new rows',
        description:
          'Each run picks up where the last one stopped. If Bitrix24 asks for a break, the import waits and resumes on its own.',
      },
      {
        icon: 'errors',
        title: 'Errors per row',
        description:
          'See which row failed and why, fix the spreadsheet and reprocess only what went wrong.',
      },
      {
        icon: 'notify',
        title: 'Error notifications',
        description:
          'Choose who gets a Bitrix24 notification when an import finishes with errors.',
      },
    ],
  },
  tutorialsSection: {
    title: 'Tutorials',
    subtitle:
      'Simulations of the real flow, inside Bitrix24. Pick a topic and click the orange highlight to move forward.',
  },
  player: {
    tabsLabel: 'Tutorials',
    variantsLabel: tutorial => `${tutorial} options`,
    done: 'Done',
    stepOf: (step, total) => `Step ${step} of ${total}`,
    hint: 'Click the orange highlight on the screen:',
    back: 'Back',
    next: 'Next',
    finish: 'Finish',
    goToStep: (step, title) => `Go to step ${step}: ${title}`,
    restart: 'Watch again',
    nextTutorial: label => `Next tutorial: ${label}`,
  },
  frame: {
    bitrixMenu: {
      crm: 'CRM',
      openChannels: 'Open Channels',
      app: 'ImportSheet',
      market: 'Market',
    },
    appMenu: {
      importacoes: 'Imports',
      configuracoes: 'Settings',
      logs: 'Logs',
      ajuda: 'Help',
    },
    poweredBy: 'Developed by CRMThink',
    beta: 'Beta version',
    portalHost: 'yourcompany.bitrix24.com',
  },
  shared: {
    importacoes: {
      title: 'Imports',
      subtitle: 'Imports workspace',
      newImport: 'New import',
      emptyBefore: 'No imports yet. Click',
      emptyAfter: 'to get started.',
    },
    lista: {
      manual: 'Manual',
      everyHours: hours => `Every ${hours}h`,
      run: 'Run',
      running: 'Running',
      scheduleActive: 'Schedule active',
      schedulePaused: 'Schedule paused',
      pauseSchedule: 'Pause schedule',
      edit: 'Edit',
      lastRun: when => `Last run: ${when}`,
      neverRun: 'Never run',
      viewErrors: 'View errors',
    },
    configuracoes: {
      title: 'Settings',
      subtitle: 'App integrations and connections',
      googleConnection: 'Google connection',
      connected: 'Connected',
      noAccount: 'No Google account connected.',
      connectGoogle: 'Connect with Google',
      disconnect: 'Disconnect',
      success: 'Google account connected successfully.',
      closeNotice: 'Close notice',
      notifyTitle: 'Error notifications',
      notifyDescription:
        'Users who will receive a notification when an import finishes with errors.',
      selectedCount: count => `${count} selected`,
      recipients: 'Recipients',
      clearAll: 'Clear all',
      noneSelected: 'No recipients selected yet.',
      searchUser: 'Search user…',
      unsaved: 'Unsaved changes',
      allSaved: 'All saved',
      save: 'Save',
    },
    configure: {
      title: 'Configure import',
      description: 'Set the Bitrix24 destination and the column mapping',
      back: 'Back',
      cancel: 'Cancel',
      save: 'Save',
      identity: {
        name: 'Import name',
        spreadsheet: 'Spreadsheet',
        tab: 'Select tab',
        startRow: 'Import from row',
        startRowHint: 'Row 01 contains the spreadsheet headers.',
      },
      destination: { entity: 'Entity', pipeline: 'Pipeline' },
      entities: {
        LEAD: 'Lead',
        DEAL: 'Deal',
        CONTACT: 'Contact',
        COMPANY: 'Company',
        SPA: 'SPA',
        TASK: 'Tasks',
        FEED: 'Livefeed',
      },
      responsible: {
        column: 'Owner (column)',
        matchBy: 'Owner identified by',
      },
      match: { id: 'ID', email: 'Email', phone: 'Phone' },
      options: {
        createContact: 'Create contact',
        createCompany: 'Create company',
      },
      schedule: {
        title: 'Schedule',
        frequency: 'Frequency',
        everyHours: 'Every (hours)',
        weekdays: 'Weekdays',
        manual: 'Run import manually',
        frequencyOptions: { hours: 'Hours', days: 'Weekdays' },
        weekdayLabels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      },
      mapping: {
        title: 'Column mapping',
        description: 'Map your spreadsheet columns to Bitrix24 fields.',
        counter: (mapped, total) => `${mapped} of ${total} mapped`,
        column: 'Column',
        destination: 'Destination',
        field: 'Bitrix fields',
        identifier: 'Identifier',
        actions: 'Actions',
        useAsIdentifier: 'Use as identifier',
        removeColumn: 'Remove column',
        destinations: { contact: 'Contact', company: 'Company' },
        fieldTypes: {
          lista: 'list',
          data: 'date',
          sn: 'Y/N',
          moeda: '$',
          contato: 'contact',
        },
      },
    },
    sample: {
      importTitle: 'Store orders',
      spreadsheetName: 'Online store 2026',
      spreadsheetId: '1AbC9xZ…',
      tab: 'Orders',
      pipeline: 'Sales',
      columns: [
        { letter: 'A', label: 'Order', target: 'main', field: 'Order no.' },
        { letter: 'B', label: 'Customer', target: 'contact', field: 'Name' },
        {
          letter: 'C',
          label: 'Email',
          target: 'contact',
          field: 'Email',
          type: 'contato',
        },
        {
          letter: 'D',
          label: 'Amount',
          target: 'main',
          field: 'Opportunity',
          type: 'moeda',
        },
        {
          letter: 'E',
          label: 'Stage',
          target: 'main',
          field: 'Stage',
          type: 'lista',
        },
        { letter: 'F', label: 'Seller', target: 'main', field: 'Seller' },
      ],
      googleEmail: 'you@company.com',
      lastRunWhen: '10/13/2026 09:00',
      manualImportTitle: 'Company records',
      manualSpreadsheetName: 'Partner companies',
    },
  },
  tutorials: {
    instalacao: INSTALACAO_EN,
    google: GOOGLE_EN,
    'nova-importacao': NOVA_IMPORTACAO_EN,
    mapeamento: MAPEAMENTO_EN,
    agendamento: AGENDAMENTO_EN,
    erros: ERROS_EN,
  },
  faq: {
    title: 'Frequently asked questions',
    items: [
      {
        question: 'The spreadsheet was not found when validating. What now?',
        answer:
          'Check that the pasted link or ID is the right spreadsheet — compare it with the browser address while the spreadsheet is open. Then, in Google Sheets, share the spreadsheet (view access is enough) with the email of the Google account connected in Settings. If the spreadsheet belongs to another account, connect that account instead.',
        link: {
          href: '#tutorial-nova-importacao',
          label: 'See the new import tutorial',
        },
      },
      {
        question: 'The Google connection dropped. How do I reconnect?',
        answer:
          'In Settings, click Connect with Google and, in the Google window, pick the account that can access the spreadsheets. This happens when access is removed in the Google account itself or expires. After reconnecting, run the import again.',
        link: {
          href: '#tutorial-google',
          label: 'See the Google connection tutorial',
        },
      },
      {
        question: 'Can I rename or delete the spreadsheet tab?',
        answer:
          'Renaming is fine: the import follows the tab under its new name. Deleting is not — without the tab the import stops running. If that happens, click Edit on the import, pick the right tab in Select tab and save.',
      },
      {
        question: 'Why are there no columns to map?',
        answer:
          'Column titles must be in row 1 of the chosen tab. If that row is empty, there are no columns to map. Check that it is the right tab and put the titles in the first row.',
      },
      {
        question: 'The row was imported, but one field is blank. Why?',
        answer:
          'Bitrix24 list fields (such as stage, source or custom lists) only accept an option that already exists. If the spreadsheet text is not exactly equal to an option — an accent, a capital letter or an extra space —, that field is skipped silently and the rest of the row is imported as usual. Make the text match the option or create the option in Bitrix24. To send those rows again, edit the import and move "Import from row" back to them; with the identifier ticked, the records are updated instead of duplicated.',
      },
      {
        question: 'How does ImportSheet avoid duplicate records?',
        answer:
          'Through the column marked as the identifier. If the value matches one record, it is updated; if it matches none, it is created; if it matches more than one, the row is not imported and shows up in the errors. In that case, merge or remove the duplicates in Bitrix24 (or choose a truly unique column) and reprocess the row.',
        link: {
          href: '#tutorial-mapeamento',
          label: 'See the mapping tutorial',
        },
      },
      {
        question: 'The record owner is not the one in the spreadsheet.',
        answer:
          'The owner column must hold the ID, email or phone (whatever you chose in "Owner identified by") of an active Bitrix24 user. If the user is not found, the row is still imported, with the default owner. Fix the value in the spreadsheet and adjust the owner of the records already created.',
      },
      {
        question: 'Does the import read the whole spreadsheet every time?',
        answer:
          'No. Each run picks up where the previous one stopped and reads only the new rows, added at the end. Rows already imported that you change later are not read again. If Bitrix24 is overloaded, the run pauses and resumes on its own from the same point.',
        link: {
          href: '#tutorial-agendamento',
          label: 'See the scheduling tutorial',
        },
      },
      {
        question: 'My scheduled import stopped running.',
        answer:
          'It may be paused: by someone, with the switch in the list, or automatically after an error that interrupted the run. Open View errors, solve the cause and turn the schedule switch back on. Whoever is in Error notifications gets a notice when this happens.',
        link: {
          href: '#tutorial-erros',
          label: 'See the errors and reprocessing tutorial',
        },
      },
    ],
  },
  finalCta: {
    title: 'Bring your spreadsheets into Bitrix24',
    subtitle:
      'Install ImportSheet from the Market or talk to our team to find the best setup for your operation.',
    fallback:
      "Look for ImportSheet in your portal's Bitrix24 Market to install it.",
  },
  ctaButtons: {
    install: 'Install on Bitrix24',
    whatsapp: 'Chat on WhatsApp',
  },
  footer: year => `ImportSheet · Google Sheets for Bitrix24 · © ${year}`,
}
