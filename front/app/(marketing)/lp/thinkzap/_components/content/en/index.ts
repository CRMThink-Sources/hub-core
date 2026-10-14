import type { LpContent } from '../types'
import { API_OFICIAL_EN } from './tutorials/api-oficial'
import { ATIVACAO_EN } from './tutorials/ativacao'
import { GRUPOS_EN } from './tutorials/grupos'
import { INSTALACAO_EN } from './tutorials/instalacao'
import { ROBOS_EN } from './tutorials/robos'
import { THINKBOT_EN } from './tutorials/thinkbot'
import { THINKZAP_TRIAL_DURATION_DAYS } from '@/shared/constants/thinkzap-trial'

export const EN: LpContent = {
  locale: 'en',
  htmlLang: 'en',
  metadata: {
    title: 'ThinkZap — WhatsApp integrated with Bitrix24',
    description:
      'Connect WhatsApp Web and the official WhatsApp API to Bitrix24: multiple lines, interactive buttons, templates, automation robots and history in the CRM.',
    ogLocale: 'en_US',
  },
  whatsappMessage:
    "Hi! I found the ThinkZap page and I'd like to know more about WhatsApp in Bitrix24.",
  nav: {
    features: 'Features',
    tutorials: 'Tutorials',
    faq: 'FAQ',
    install: 'Install',
  },
  languageSwitch: { label: 'Language' },
  hero: {
    eyebrow: 'WhatsApp inside Bitrix24',
    title: 'Support, sell and automate over WhatsApp without leaving your CRM',
    subtitle:
      'ThinkZap connects WhatsApp Web and the official WhatsApp API to Bitrix24. Conversations land in your open channels, stay in the customer history and feed your automations.',
  },
  chatPreview: {
    contactDetail: 'WhatsApp · Sales line · Deal #1042',
    messages: {
      question: 'Hi! Do you deliver to Curitiba?',
      answer: 'We sure do, Maria! Would you like me to send the quote?',
      ask: 'How would you like to receive it?',
      options: ['Right here', 'By email'],
      reply: 'Right here, please 😊',
    },
    robot: {
      before: 'Bitrix24 robot: deal moved to',
      stage: 'Proposal sent',
    },
  },
  features: {
    title: 'Everything your team needs on WhatsApp',
    subtitle: 'From first contact to after-sales, with the history in the CRM.',
    items: [
      {
        icon: 'channels',
        title: 'WhatsApp Web and official API',
        description:
          'Use the number you already have through WhatsApp Web or connect the official WhatsApp Business API — both in the same panel.',
      },
      {
        icon: 'lines',
        title: 'Multiple lines',
        description:
          'Connect as many numbers as you need and link each one to a Bitrix24 open channel, per team or operation.',
      },
      {
        icon: 'buttons',
        title: 'Interactive buttons',
        description:
          'Send messages with reply buttons and record what the customer chose right in the timeline.',
      },
      {
        icon: 'templates',
        title: 'Message templates',
        description:
          'Send approved templates from the official API to reopen conversations and reach out proactively.',
      },
      {
        icon: 'automation',
        title: 'Automation robots',
        description:
          'Send messages from Bitrix24 rules and robots: new deal, stage change, payment reminder.',
      },
      {
        icon: 'stats',
        title: 'Message dashboard',
        description:
          'Track the volume of messages sent and received by period and by connection.',
      },
      {
        icon: 'permissions',
        title: 'Team permissions',
        description:
          'Choose who can access connections and settings, by user or department.',
      },
      {
        icon: 'media',
        title: 'Audio, images and documents',
        description:
          'Media, replies and message edits synced between WhatsApp and the Bitrix24 chat.',
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
      app: 'ThinkZap',
      market: 'Market',
    },
    appMenu: {
      home: 'Home',
      conexoes: 'Connections',
      administracao: 'Administration',
      thinkbot: 'ThinkBot',
      logs: 'Logs',
      ajuda: 'Help',
    },
    poweredBy: 'Developed by CRMThink',
    beta: 'Beta version',
    portalHost: 'yourcompany.bitrix24.com',
  },
  shared: {
    conexoesTitle: 'Settings',
    conexoesSubtitle: 'Manage the WhatsApp numbers connected to Bitrix24',
    providerLabel: { web: 'WhatsApp Web', oficial: 'Official' },
    activeLines: count => `Active lines: ${count}`,
    tableName: 'Name',
    tableStatus: 'Status',
    lineTabs: {
      conexao: 'Connection',
      grupos: 'Groups',
      templates: 'Templates',
      ajustes: 'Settings',
    },
    defaultLineName: 'Line 1',
    backToConnections: '← Back to connections',
    connected: 'Connected',
    disconnected: 'Disconnected',
    webHint:
      'Connects by scanning the QR code on your phone. Quickest to start.',
    oficialHint:
      "Meta's official channel, with a verified number and templates.",
    deal: {
      title: 'Maria Clara order',
      contact: 'Maria Clara',
      value: 'R$ 2,400.00',
    },
    dealLabel: (id, value) => `Deal #${id} · ${value}`,
    dealTabs: {
      geral: 'General',
      produtos: 'Products',
      thinkzap: 'ThinkZap',
      historico: 'History',
    },
    stages: {
      novo: 'New',
      proposta: 'Proposal sent',
      negociacao: 'Negotiation',
      fechado: 'Closed',
    },
    dealsTitle: 'Deals',
    filterSearch: 'Filter + search',
  },
  tutorials: {
    instalacao: INSTALACAO_EN,
    ativacao: ATIVACAO_EN,
    thinkbot: THINKBOT_EN,
    'api-oficial': API_OFICIAL_EN,
    robos: ROBOS_EN,
    grupos: GRUPOS_EN,
  },
  faq: {
    title: 'Frequently asked questions',
    items: [
      {
        question: 'Do I need a new number?',
        answer:
          'No. You can connect the number you already use, through WhatsApp Web, or use a number on the official WhatsApp Business API.',
      },
      {
        question:
          "What's the difference between WhatsApp Web and the official API?",
        answer:
          "WhatsApp Web connects through a QR code and uses the phone just like today. The official API is Meta's approved channel, with approved templates and proactive messaging at scale. ThinkZap works with both.",
      },
      {
        question: 'Does it work on any Bitrix24 plan?',
        answer:
          'ThinkZap uses Bitrix24 open channels (Contact Center). If your plan has open channels, it works on your portal.',
      },
      {
        question: 'Does my team need to leave Bitrix24 to reply?',
        answer:
          'No. Messages arrive in the open channel chat and are linked to the contact and the deal in the CRM.',
      },
      {
        question: 'Can I try it before buying?',
        answer: `Yes. After installing, you start a free ${THINKZAP_TRIAL_DURATION_DAYS}-day trial right on the Connections screen, without talking to anyone. The trial is one per installation.`,
      },
      {
        question: 'Does ThinkZap have a chatbot?',
        answer:
          'It does. With ThinkBot you build the support flow out of blocks — questions, data capture, CRM-based conditions and handoff to an agent —, test it in the simulator and turn it on in any Bitrix24 open channel.',
        link: {
          href: '#tutorial-thinkbot',
          label: 'See the ThinkBot tutorial',
        },
      },
    ],
  },
  finalCta: {
    title: 'Bring WhatsApp into your Bitrix24',
    subtitle:
      'Install ThinkZap from the Market or talk to our team to find the best setup for your operation.',
    fallback:
      "Look for ThinkZap in your portal's Bitrix24 Market to install it.",
  },
  ctaButtons: {
    install: 'Install on Bitrix24',
    whatsapp: 'Chat on WhatsApp',
  },
  footer: year => `ThinkZap · WhatsApp app for Bitrix24 · © ${year}`,
}
