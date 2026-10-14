import type { GrupoCopy } from '../../pt/tutorials/grupo'

export const GRUPO_EN: GrupoCopy = {
  tutorial: {
    slug: 'grupo',
    label: 'Signature group',
    summary:
      'The group says which field holds the document, where to write the result and who signs.',
    steps: [
      {
        screen: 'new-group',
        title: 'Create a group',
        description:
          'In the app, under Signature groups, click New Group. You can have one group for each kind of document.',
        action: 'New Group',
      },
      {
        screen: 'group-id',
        title: 'Name the group',
        description:
          'The identifier is the name you pick later in the Bitrix24 robot.',
        action: 'Group identifier',
      },
      {
        screen: 'deal-fields',
        title: 'Link the Deal fields',
        description:
          'Under Deal Fields, pick the fields created in the previous tutorial. In File for Signature only the first file of the field counts, as PDF, DOC, DOCX, PNG or JPG.',
        action: 'File for Signature',
      },
      {
        screen: 'default-contact',
        title: 'Set who signs',
        description:
          "Under Contacts Setup, a new group already comes with one contact; Add Contact includes others. With Use the deal's default contact turned on, every contact of the deal signs, with the CPF from the field chosen in the Extra tab. Turned off, you point to the Deal fields with the name, email and CPF of the signer. Group (1 to 10) sets the signing order.",
        action: "Use the deal's default contact",
      },
      {
        screen: 'add-participant',
        title: 'Include someone from your team',
        description:
          'Under Participants, click Add to include a Bitrix24 user who also signs — a manager or a witness, for example.',
        action: 'Add',
      },
      {
        screen: 'participant',
        title: 'Pick the user and the role',
        description:
          'Pick a fixed User or a User Field of the deal (such as the person responsible), the Role they sign with and the Group.',
        action: 'Role',
      },
      {
        screen: 'save',
        title: 'Save',
        description:
          'Click Save. Created, renamed or deleted a group or a company? Save and open the robot again so its lists refresh.',
        action: 'Save',
      },
    ],
    done: {
      title: 'Group ready',
      description:
        'Only the robot is left: it sends the document when the deal reaches the right stage.',
    },
  },
  screens: {},
}
