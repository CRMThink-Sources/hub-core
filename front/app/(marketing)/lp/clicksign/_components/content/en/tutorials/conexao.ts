import type { ConexaoCopy } from '../../pt/tutorials/conexao'

export const CONEXAO_EN: ConexaoCopy = {
  tutorial: {
    slug: 'conexao',
    label: 'Connect Clicksign',
    summary:
      'Register the Clicksign account that sends the documents: access token, environment and reminder.',
    steps: [
      {
        screen: 'name',
        title: 'Name the company',
        description:
          'In the app, under Settings › Main, the first company already comes blank, named New Company. Rename it after your account: this is the name shown in the Bitrix24 robot. Each company is one Clicksign account — to add another one, click New Company.',
        action: 'Company name',
      },
      {
        screen: 'token',
        title: 'Paste the access token',
        description:
          'In the Clicksign dashboard, copy the API access token of your account and paste it into Access Token. It authorizes sending through your account.',
        action: 'Access Token',
      },
      {
        screen: 'environment',
        title: 'Choose the environment',
        description:
          'Production sends real documents. Sandbox is the Clicksign testing environment. The token must belong to the environment chosen here.',
        action: 'Production',
      },
      {
        screen: 'reminder',
        title: 'Set the automatic reminder',
        description:
          'Clicksign reminds whoever has not signed yet every 1, 2, 3, 7 or 14 days.',
        action: '3 days',
      },
      {
        screen: 'save',
        title: 'Save',
        description:
          'Click Save. When you save, the app turns on the Clicksign status updates to Bitrix24 by itself — there is nothing to set up in the Clicksign dashboard.',
        action: 'Save',
      },
    ],
    done: {
      title: 'Clicksign connected',
      description:
        'The account is ready to send. Now prepare the Deal with the fields that receive the document and the signature result.',
    },
  },
  screens: {},
}
