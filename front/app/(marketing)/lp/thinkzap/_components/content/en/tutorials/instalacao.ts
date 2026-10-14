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
          'In your Bitrix24, open the Market, search for ThinkZap and click the app card.',
        action: 'ThinkZap',
      },
      {
        screen: 'market-app',
        title: 'Install from the app page',
        description:
          'The ThinkZap page opens over the catalog, showing the developer (CRMThink) and the category. Click Install.',
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
      appTagline: 'WhatsApp Web and the official API integrated with Bitrix24',
      appCategory: 'Communication',
      appsCount: '830+ apps',
      catalog: 'Catalog',
      scope: 'All Market',
      favorites: 'Favorites',
      more: 'More',
      searchResults: 'Search results',
      seeAll: 'All',
      install: 'Install',
      priceTag: 'Free',
      inAppPurchases: 'In-app purchases',
      rating: 'Rating',
      installs: 'Installs',
      developer: 'Developer',
      category: 'Category',
      description: 'Description',
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
