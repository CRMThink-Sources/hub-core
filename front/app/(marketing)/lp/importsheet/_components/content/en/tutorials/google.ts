import type { GoogleCopy } from '../../pt/tutorials/google'

export const GOOGLE_EN: GoogleCopy = {
  tutorial: {
    slug: 'google',
    label: 'Connect Google',
    summary:
      'The connected Google account is the one that opens your spreadsheets: connect one that can access them.',
    steps: [
      {
        screen: 'settings',
        title: 'Connect the account in Settings',
        description:
          'In the app menu, open Settings. The Google connection card shows that no account is connected — until then, the New import button stays locked. Click Connect with Google.',
        action: 'Connect with Google',
      },
      {
        screen: 'consent',
        title: 'Authorize it on Google',
        description:
          'A Google window opens. Pick the account that can access the spreadsheets and allow read access. ImportSheet only reads — it never changes your spreadsheet.',
        action: 'Continue',
      },
      {
        screen: 'connected',
        title: 'Account connected',
        description:
          'The card now shows Connected and the account email. The spreadsheets you import must be shared with that email.',
        action: 'Connected',
      },
    ],
    done: {
      title: 'Google connected',
      description:
        'The notice disappears from Imports and the New import button is unlocked. Now pick the spreadsheet.',
    },
  },
  screens: {
    consent: {
      signIn: 'Sign in with Google',
      heading: 'ImportSheet wants to access your Google Account',
      allow: 'This will allow ImportSheet to:',
      scopes: [
        'See all your Google Sheets spreadsheets',
        'See and download all your Google Drive files',
      ],
      cancel: 'Cancel',
      proceed: 'Continue',
    },
  },
}
