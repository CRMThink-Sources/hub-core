import type { RoboCopy } from '../../pt/tutorials/robo'

export const ROBO_EN: RoboCopy = {
  tutorial: {
    slug: 'robo',
    label: 'Sending robot',
    summary:
      'Documents are sent only by the Send document robot, on a stage of the Deals pipeline.',
    steps: [
      {
        screen: 'kanban',
        title: 'Open the automation rules',
        description:
          'In the Bitrix24 CRM, under Deals, click Automation rules. The Clicksign robot comes installed with the app and works only on Deals.',
        action: 'Automation rules',
      },
      {
        screen: 'stages',
        title: 'Pick the stage',
        description:
          'The document goes out when the deal enters the stage. Click the + of the "Contract" stage.',
        action: 'Add robot to Contract',
      },
      {
        screen: 'catalog',
        title: 'Pick the Clicksign robot',
        description:
          'In the Add window, search for "clicksign" and click Add on [Clicksign] Send document.',
        action: '[Clicksign] Send document',
      },
      {
        screen: 'robot-token',
        title: 'Choose how the code arrives',
        description:
          'In Token delivery, choose where the signer gets the confirmation code: Email, SMS or Whatsapp.',
        action: 'Token delivery',
      },
      {
        screen: 'robot-group',
        title: 'Pick the group',
        description:
          'In Signature group, pick the group created in the app. Not listed? Save the groups in the app and open the robot again.',
        action: 'Signature group',
      },
      {
        screen: 'robot-sequence',
        title: 'Set the order and refusal',
        description:
          'In Enable sequence, Yes makes people sign one at a time — participants first, then contacts — and the Group numbers are ignored. No follows the Group numbers. In Allow refusal?, say whether the signer can refuse.',
        action: 'Enable sequence',
      },
      {
        screen: 'robot-save',
        title: 'Pick the company and save',
        description:
          'In Company, pick the Clicksign account that sends the document and click Save.',
        action: 'Save',
      },
      {
        screen: 'move-deal',
        title: 'Move a deal',
        description:
          'When a deal enters "Contract", the file in the File for Signature field goes to Clicksign and the signers get the invitation.',
        action: 'Move to Contract',
      },
    ],
    done: {
      title: 'Automatic sending is live',
      description:
        'Every deal that reaches the stage sends its own document. Next, see how to follow the signatures.',
    },
  },
  screens: {
    robot: '[Clicksign] Send document',
    board: {
      extensions: 'Extensions',
      rules: 'Automation rules',
      otherDeals: [
        {
          title: 'Office renovation',
          contact: 'Rafael Souza',
          value: 'R$ 8,900.00',
        },
        { title: 'Consulting', contact: 'Ana Prado', value: 'R$ 4,500.00' },
      ],
    },
    stages: {
      title: 'Automation rules · Deals',
      hint: 'Robots run when the deal enters the stage.',
    },
    catalog: {
      title: 'Add',
      toStage: 'to stage',
      search: 'clicksign',
      rules: 'Automation rules and triggers',
      description: 'Send a document for signature',
      add: 'Add',
    },
    robotForm: {
      token: 'Token delivery',
      tokenValue: 'Email',
      group: 'Signature group',
      sequence: 'Enable sequence',
      sequenceValue: 'No',
      refusable: 'Allow refusal?',
      refusableValue: 'No',
      company: 'Company',
      runWhen: (stage: string) =>
        `Run: when the deal enters the "${stage}" stage`,
      save: 'Save',
      cancel: 'Cancel',
    },
  },
}
