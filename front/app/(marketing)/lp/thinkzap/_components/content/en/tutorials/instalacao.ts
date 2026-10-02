import type { InstalacaoCopy } from '../../pt/tutorials/instalacao'

export const INSTALACAO_EN: InstalacaoCopy = {
  tutorial: {
    slug: 'instalacao',
    label: 'Installation',
    summary: 'From the Bitrix24 Market to the app installed on your portal.',
    steps: [
      {
        screen: 'market',
        title: 'Find ThinkZap in the Market',
        description:
          'In your Bitrix24, open the Market, search for ThinkZap and click Install.',
        action: 'Install',
      },
      {
        screen: 'install',
        title: 'Accept the terms and finish',
        description:
          'On the installation screen, accept the Bitrix24 Market terms. The email is optional.',
        action: 'Finish installation',
      },
    ],
    done: {
      title: 'ThinkZap installed',
      description:
        'The app is now in your Bitrix24 menu. Next: start the trial and connect your number.',
    },
  },
  screens: {
    market: {
      title: 'Market',
      appTagline: 'WhatsApp Web and the official API integrated with Bitrix24',
      category: 'Communication',
    },
    install: {
      title: 'App installation',
      subtitle: 'Fill in the details and accept the terms to finish.',
      emailLabel: 'Installation email (optional)',
      emailPlaceholder: 'you@company.com',
      termsTitle: 'Terms and acceptance',
      accept: 'I have read and accept the',
      terms: [
        'Bitrix24 Market terms of use',
        'License agreement (EULA)',
        'Privacy policy',
      ],
      submit: 'Finish installation',
    },
  },
}
