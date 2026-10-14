import type { LpContent } from '../types'
import { ACOMPANHAMENTO_EN } from './tutorials/acompanhamento'
import { CONEXAO_EN } from './tutorials/conexao'
import { GRUPO_EN } from './tutorials/grupo'
import { INSTALACAO_EN } from './tutorials/instalacao'
import { NEGOCIO_EN } from './tutorials/negocio'
import { ROBO_EN } from './tutorials/robo'

// Robô e timeline só existem em português no portal: aqui vão traduzidos.
export const EN: LpContent = {
  locale: 'en',
  htmlLang: 'en',
  metadata: {
    title: 'Clicksign — Electronic signature integrated with Bitrix24',
    description:
      'Send Bitrix24 documents for signature on Clicksign through an automation robot, follow each signature on the deal timeline and get the signed PDF back.',
    ogLocale: 'en_US',
  },
  whatsappMessage:
    "Hi! I found the Clicksign integration page and I'd like to know more about signing documents from Bitrix24.",
  nav: {
    features: 'Features',
    tutorials: 'Tutorials',
    faq: 'FAQ',
    install: 'Install',
  },
  languageSwitch: { label: 'Language' },
  hero: {
    eyebrow: 'Clicksign inside Bitrix24',
    title: 'Agreements signed without leaving the deal',
    subtitle:
      'When the deal reaches the right stage, the document goes to Clicksign by itself. Signers get the invitation, and the signed PDF comes back to Bitrix24.',
  },
  signPreview: {
    document: 'Service agreement.pdf',
    sentFrom: 'Sent by the robot on the Contract stage',
    deal: 'Deal · Annual plan',
    signers: [
      { name: 'Maria Clara', signed: true },
      { name: 'Paulo Henrique', signed: true },
      { name: 'Livia Torres', signed: false },
    ],
    signed: 'signed',
    waiting: 'waiting',
    signedFile: 'Signed File attached',
  },
  features: {
    title: 'From the pipeline stage to the signed agreement',
    subtitle:
      'Set it up once and let every deal send its own document for signature.',
    items: [
      {
        icon: 'robot',
        title: 'Sent by the Bitrix24 robot',
        description:
          'The document goes out by itself when the deal enters the stage you choose, through the Send document robot.',
      },
      {
        icon: 'mapping',
        title: 'Your own Deal fields',
        description:
          'You choose which field holds the document and where to write the ID, the status, the date and the signed PDF.',
      },
      {
        icon: 'groups',
        title: 'Signature groups',
        description:
          'One group for each kind of document, with the deal contacts and people from your team, in the order you set.',
      },
      {
        icon: 'auth',
        title: 'Signer verification',
        description:
          'Code by email, SMS or WhatsApp and, if you want, selfie, official document, handwritten signature or facial biometrics.',
      },
      {
        icon: 'timeline',
        title: 'Tracking on the timeline',
        description:
          'A card on the deal shows who has signed and is updated with every signature.',
      },
      {
        icon: 'signedFile',
        title: 'Signed PDF on the deal',
        description:
          'When everyone signs, the final document is attached to the deal by itself.',
      },
      {
        icon: 'companies',
        title: 'Several Clicksign accounts',
        description:
          'Register more than one company and choose in each robot which account sends.',
      },
      {
        icon: 'cancel',
        title: 'Refusal and cancellation',
        description:
          'Allow refusing with a reason and cancel a sending right from the card, all recorded on the timeline.',
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
      app: 'ClickSign',
      market: 'Market',
    },
    appMenu: {
      configuracoes: 'Settings',
      assinatura: 'Signature groups',
      logs: 'Logs',
      ajuda: 'Help',
    },
    poweredBy: 'Developed by CRMThink',
    beta: 'Beta version',
    portalHost: 'yourcompany.bitrix24.com',
  },
  shared: {
    select: 'Select…',
    configuracoes: {
      tabPrincipal: 'Main',
      tabExtra: 'Extra',
      companiesTitle: 'Company Settings',
      companiesDescription: 'Manage the Clicksign integration settings',
      newCompany: 'New Company',
      tokenLabel: 'Access Token',
      tokenHint: 'Clicksign API authentication token',
      tokenPlaceholder: 'Paste the Clicksign token',
      environmentLabel: 'Environment',
      environmentHint: 'Clicksign integration environment',
      environments: { prod: 'Production', sandbox: 'Sandbox' },
      reminderLabel: 'Automatic Reminder',
      reminderHint: 'Frequency of signature reminders',
      reminderDays: days => (days === 1 ? '1 day' : `${days} days`),
      save: 'Save',
      additionalTitle: 'Additional Settings',
      extras: {
        selfie: 'Use Selfie as authentication',
        facialBiometrics:
          'Use facial biometrics as an additional authentication point for the signer',
        handwritten:
          'Use handwritten signature as an authentication point at the moment of signing',
        officialDocument:
          'Request a photo (front and back) of the official document',
        rubrica: 'Request initials (requires enabling the envelope feature)',
      },
      facialBiometricsHint:
        'Additional cost of R$ 1.50 per facial biometrics successfully performed (charged by Clicksign).',
      contactFieldsTitle: 'Contact Fields',
      contactFieldsDescription:
        'This mapping is required when the signer of the signature group is the deal\'s "Default contact".',
      cpfLabel: 'CPF',
      isForeignLabel: 'Is foreign?',
      signAsLabel: 'Sign as',
      signAsValue: '[Clicksign] Sign as',
      signAsHint: 'Field created during APP installation (do not delete)',
    },
    assinatura: {
      title: 'Signature Setup',
      description:
        'Configure the signature groups and their fields in Bitrix24',
      save: 'Save',
      newGroup: 'New Group',
      empty: 'No signature groups. Click “New Group” to start.',
      group: 'Group',
      groupIdPlaceholder: 'Group identifier',
      dealFields: 'Deal Fields',
      fields: {
        arquivo: {
          label: 'File for Signature',
          hint: 'Field containing the file to be signed',
        },
        dataLimite: {
          label: 'Deadline',
          hint: 'Deadline for signing the document',
        },
        documentoId: {
          label: 'Document ID',
          hint: 'Field to store the document ID in Clicksign',
        },
        status: {
          label: 'Signature Status',
          hint: 'Field indicating whether the document was signed',
        },
        finalizado: {
          label: 'Process Completed',
          hint: 'Field indicating whether the signature process was completed',
        },
        dataAssinatura: {
          label: 'Signature Date',
          hint: 'Date the document was signed',
        },
        arquivoAssinado: {
          label: 'Signed File',
          hint: 'Field where the signed document will be saved',
        },
      },
      contactsTitle: 'Contacts Setup',
      addContact: 'Add Contact',
      participantsTitle: 'Participants',
      add: 'Add',
      useDefaultContact: "Use the deal's default contact",
      useDefaultContactHint: 'If disabled, you can select custom fields',
      userLabel: 'User',
      userHint: 'Select a fixed user or use a Bitrix field',
      roleLabel: 'Role',
      emailLabel: 'Email',
      emailPlaceholder: 'Participant email',
      isForeign: 'Is foreign',
    },
    crm: {
      dealsTitle: 'Deals',
      filterSearch: 'Filter and search',
      stages: {
        novo: 'New',
        proposta: 'Proposal sent',
        contrato: 'Contract',
        ganho: 'Deal won',
      },
      fieldKinds: { file: 'File', date: 'Date', text: 'String' },
      dealLabel: (id, value) => `Deal #${id} · ${value}`,
      about: 'About the deal',
      timeline: 'Timeline',
      empty: 'not filled in',
    },
    card: {
      title: '[Clicksign]',
      intro: 'Document sent for signature',
      header: (documentId, group) => `Document ${documentId} - ${group}`,
      canceledHeader: documentId => `Document ${documentId}`,
      status: {
        progress: 'In progress',
        finished: 'Completed',
        refused: 'Refused',
        canceled: 'Canceled',
      },
      signer: { waiting: 'Waiting', signed: 'Signed', refused: 'Refused' },
      cancel: 'Cancel document',
    },
    sample: {
      companyName: 'Acme Ltd',
      companyDraft: 'New Company',
      token: 'a3f1c9e2-7b4d-4e8a-9c21-5d6e0f7a8b90',
      groupId: 'Service agreement',
      documentId: '8e2b…41f0',
      deal: {
        title: 'Annual plan',
        contact: 'Maria Clara',
        value: 'R$ 12,000.00',
      },
      signers: [
        { name: 'Ana Souza', email: 'ana@yourcompany.com' },
        { name: 'Maria Clara', email: 'maria@client.com' },
      ],
      user: 'Ana Souza',
      role: 'Sign as contracting party',
      fileName: 'service-agreement.pdf',
      signedFileName: 'service-agreement-signed.pdf',
      signedAt: '10/14/2026',
      yes: 'Yes',
      cpfField: 'CPF',
      foreignField: 'Foreigner',
    },
  },
  tutorials: {
    instalacao: INSTALACAO_EN,
    conexao: CONEXAO_EN,
    negocio: NEGOCIO_EN,
    grupo: GRUPO_EN,
    robo: ROBO_EN,
    acompanhamento: ACOMPANHAMENTO_EN,
  },
  faq: {
    title: 'Frequently asked questions',
    items: [
      {
        question:
          'I got "Document not attached to the deal" or "Could not download the attached file". What do I do?',
        answer:
          'The robot did not find the document on the deal. Attach the file to the field chosen in File for Signature of the group — only the first file counts, as PDF, DOC, DOCX, PNG or JPG. If the file was already there, attach it again. Then run the robot once more by moving the deal out of the stage and back.',
        link: {
          href: '#tutorial-grupo',
          label: 'See the signature group tutorial',
        },
      },
      {
        question: 'I got "No signer found for the selected group".',
        answer:
          'The group found nobody to sign. Check that the signer name and email fields are filled in on the deal and that the group points to the right fields. With "Use the deal\'s default contact" turned on, the deal needs at least one linked contact. Fix it and run the robot again.',
        link: {
          href: '#tutorial-grupo',
          label: 'See the signature group tutorial',
        },
      },
      {
        question: 'The robot ran and nothing happened. Is the group gone?',
        answer:
          'If the group was renamed or deleted, the robot still points to the old one and the sending stops with no notice on the timeline — the reason shows up in Logs, in the app. Under Signature groups, click Save, open the robot in Bitrix24 and pick the group again.',
        link: {
          href: '#tutorial-robo',
          label: 'See the sending robot tutorial',
        },
      },
      {
        question: 'I changed the company or the token and sending stopped.',
        answer:
          'The robot keeps the company that was chosen in it. After changing the token or removing the company, save Settings, open the robot and pick the Company again.',
        link: {
          href: '#tutorial-robo',
          label: 'See the sending robot tutorial',
        },
      },
      {
        question: 'Clicksign rejected the sending. Why?',
        answer:
          'The Clicksign message shows up in a [Clicksign] comment on the deal timeline and in Logs, in the app. The most common causes are an invalid or expired token, a token from one environment with the other one chosen in Environment (Production × Sandbox) and limits of your Clicksign account. Fix it in Settings, save and run the robot again.',
        link: {
          href: '#tutorial-conexao',
          label: 'See the Clicksign connection tutorial',
        },
      },
      {
        question:
          'The document was signed, but the status does not come back to Bitrix24.',
        answer:
          'In Settings, check that the token and the Environment are right and click Save again: when you save, the app turns the Clicksign status updates back on by itself. There is nothing to set up in the Clicksign dashboard.',
        link: {
          href: '#tutorial-conexao',
          label: 'See the Clicksign connection tutorial',
        },
      },
      {
        question: 'Everyone signed, but the PDF was not attached to the deal.',
        answer:
          'The app retries by itself for a while. Check that the field chosen in Signed File is a file field and that the document is up to 25 MB. Above that, download the signed PDF from the Clicksign dashboard and attach it to the deal by hand.',
        link: {
          href: '#tutorial-acompanhamento',
          label: 'See the tracking tutorial',
        },
      },
      {
        question: 'I could not cancel the document.',
        answer:
          'A document already signed by everyone, completed or expired cannot be canceled, and the timeline shows a comment with the reason. Check its state in the Clicksign dashboard. If it was a passing failure, click Cancel document again.',
      },
      {
        question:
          'Does the deal change stage by itself when the document is signed?',
        answer:
          'No. The app fills in Signature Status, Signature Date, Process Completed and Signed File on the deal. To move the deal, create your own Bitrix24 automation based on changes to these fields.',
        link: {
          href: '#tutorial-acompanhamento',
          label: 'See the tracking tutorial',
        },
      },
      {
        question: 'The robot ran before I saved the Settings.',
        answer:
          'Without a saved company and token, the robot has no account to send through and nothing goes to Clicksign. Register the company in Settings, save, build the signature group and run the robot again.',
        link: {
          href: '#tutorial-conexao',
          label: 'See the Clicksign connection tutorial',
        },
      },
    ],
  },
  finalCta: {
    title: 'Sign agreements without leaving Bitrix24',
    subtitle:
      'Install the Clicksign integration from the Market or talk to our team to set up the signature flow for your operation.',
    fallback:
      "Look for Clicksign in your portal's Bitrix24 Market to install it.",
  },
  ctaButtons: {
    install: 'Install on Bitrix24',
    whatsapp: 'Chat on WhatsApp',
  },
  footer: year => `Clicksign · Electronic signature for Bitrix24 · © ${year}`,
}
