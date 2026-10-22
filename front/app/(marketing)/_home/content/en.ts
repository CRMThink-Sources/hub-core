import type { HomeContent } from './types'

export const en: HomeContent = {
  locale: 'en',
  htmlLang: 'en',
  metadata: {
    title: 'Think Hub — CRMThink apps for Bitrix24',
    description:
      'WhatsApp, e-signature, spreadsheet import, BI and AI agents inside your Bitrix24. Discover the Think Hub apps.',
    ogLocale: 'en_US',
  },
  languageSwitch: { label: 'Language' },
  nav: { apps: 'Apps', why: 'Why Think Hub', cta: 'See the apps' },
  hero: {
    eyebrow: 'CRMThink apps for Bitrix24',
    title: 'Everything your Bitrix24 does not do yet,',
    highlight: 'connected in one place',
    subtitle:
      'Think Hub brings together the CRMThink apps: WhatsApp in open channels, contracts signed from the deal, spreadsheets imported into the CRM, external data in BI and AI agents serving your customers.',
    primary: 'Discover the apps',
    secondary: 'Why Think Hub',
    diagramLabel: 'Think Hub apps connected to Bitrix24',
  },
  apps: {
    title: 'Pick the app for your challenge',
    subtitle:
      'Each app solves one part of the process and works inside Bitrix24 — no switching screens.',
    learnMore: name => `Discover ${name}`,
    comingSoon: 'Page coming soon',
    items: {
      thinkzap: {
        tagline: 'WhatsApp inside Bitrix24',
        description:
          'Serve customers over WhatsApp in open channels and send messages from CRM automation rules.',
        highlights: [
          'Official API and WhatsApp Web',
          'Templates and button messages',
          'Sending from pipeline robots',
        ],
      },
      clicksign: {
        tagline: 'E-signature from the deal',
        description:
          'Generate contracts and send them for signature straight from the pipeline stage, tracked on the timeline.',
        highlights: [
          'Documents filled with deal fields',
          'Signer groups and signing order',
          'Signed PDF back in the CRM',
        ],
      },
      importsheet: {
        tagline: 'Spreadsheets straight into the CRM',
        description:
          'Import Google spreadsheets into Bitrix24 with field mapping and scheduling.',
        highlights: [
          'Google Sheets connection',
          'Column-to-field mapping',
          'Scheduled imports',
        ],
      },
      thinkanalise: {
        tagline: 'External data in Bitrix24 BI',
        description:
          'Connect APIs from other systems and bring their data into BI Builder datasets.',
        highlights: [
          'Configurable API connections',
          'Datasets in BI Builder',
          'Logs for every sync',
        ],
      },
      gptmaker: {
        tagline: 'AI agents in customer service',
        description:
          'Put an AI agent to work in open channels, querying the CRM and handing off to humans.',
        highlights: [
          'Service in open channels',
          'CRM lookups and updates',
          'Handoff to an operator',
        ],
      },
    },
  },
  why: {
    title: 'Why Think Hub',
    subtitle:
      'Apps built for teams that already live in Bitrix24 and do not want one more tool to open.',
    items: [
      {
        icon: 'bitrix',
        title: 'Inside Bitrix24',
        description:
          'The apps show up in the CRM, open channels and the robots your team already uses.',
      },
      {
        icon: 'market',
        title: 'Installed from the Market',
        description:
          'Install from the Bitrix24 Market and set up in a few steps, with tutorials on every page.',
      },
      {
        icon: 'support',
        title: 'Built by a Bitrix24 partner',
        description:
          'Developed and maintained by CRMThink, supported by people who deploy Bitrix24 every day.',
      },
      {
        icon: 'languages',
        title: 'Portuguese, English and Spanish',
        description:
          'Interfaces and content in the languages your operation runs in.',
      },
    ],
  },
  finalCta: {
    title: 'Start with the app you miss the most today',
    subtitle:
      'Each app has its own page with features, tutorials and the install link.',
    button: 'See the apps',
  },
  footer: year => `© ${year} CRMThink. All rights reserved.`,
}
