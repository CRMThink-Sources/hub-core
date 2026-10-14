import type { NegocioCopy } from '../../pt/tutorials/negocio'

export const NEGOCIO_EN: NegocioCopy = {
  tutorial: {
    slug: 'negocio',
    label: 'Prepare the Deal',
    summary:
      'Create the Deal fields that hold the document and the signature result, and pick the signer checks.',
    steps: [
      {
        screen: 'crm-fields',
        title: 'Create the Deal fields',
        description:
          'First of all, in the Bitrix24 CRM settings, create these custom fields on the Deal: two file fields (the document to sign and the Signed File), two date fields (Deadline and Signature Date) and three text fields (Document ID, Signature Status and Process Completed). The app does not create these fields.',
        action: 'Add field',
      },
      {
        screen: 'extra-tab',
        title: 'Open the Extra tab',
        description: 'Back in the app, under Settings, click the Extra tab.',
        action: 'Extra',
      },
      {
        screen: 'additional',
        title: 'Pick the checks',
        description:
          'Under Additional Settings, tick what Clicksign should ask from whoever signs: selfie, facial biometrics, handwritten signature, a photo of the official document or initials (initials require the envelope feature on your account). Facial biometrics has an additional cost of R$ 1.50 per facial biometrics successfully performed (charged by Clicksign).',
        action: 'Request a photo (front and back) of the official document',
      },
      {
        screen: 'contact-fields',
        title: 'Point to the contact fields',
        description:
          'Under Contact Fields, pick the contact field that holds the CPF and the one that says whether the person is foreign. It is required when the signer is the deal contact.',
        action: 'CPF',
      },
      {
        screen: 'save-extra',
        title: 'Save',
        description: 'Click Save to keep the Extra tab.',
        action: 'Save',
      },
    ],
    done: {
      title: 'Deal ready',
      description:
        'The fields exist and the checks are chosen. Now build the signature group, which links each field to its role.',
    },
  },
  screens: {
    crmFields: {
      title: 'Custom fields · Deal',
      name: 'Name',
      type: 'Type',
      add: 'Add field',
    },
  },
}
