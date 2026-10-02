import type { RobosScreen, Tutorial, TutorialStep } from '../../types'
import type { RobosCopy } from '../../pt/tutorials/robos'

/** Steps shared by both variants: open the rules and the stage's "+". */
const ROBOS_OPEN: TutorialStep<RobosScreen>[] = [
  {
    screen: 'kanban',
    title: 'Open the automation rules',
    description:
      'In the Bitrix24 CRM, under Deals, click Automation rules. The ThinkZap robots come preinstalled with the app.',
    action: 'Automation rules',
  },
  {
    screen: 'stages',
    title: 'Pick the stage',
    description:
      'The robot runs when a deal enters the stage. Click the + on the "Proposal sent" stage.',
    action: 'Add robot to Proposal sent',
  },
]

const ROBOS_MOVE: TutorialStep<RobosScreen> = {
  screen: 'move-deal',
  title: 'Move a deal',
  description:
    'Drag a deal to "Proposal sent", just like your team does every day.',
  action: 'Move to Proposal sent',
}

const tutorial: Tutorial<RobosScreen> = {
  slug: 'robos',
  label: 'Automation robots',
  variants: [
    {
      key: 'mensagem',
      label: 'Send message',
      summary:
        'A WhatsApp message sent automatically when a deal changes stage.',
      steps: [
        ...ROBOS_OPEN,
        {
          screen: 'catalog',
          title: 'Pick the ThinkZap robot',
          description:
            'In the Add window, search for "thinkzap" and click Add next to [ThinkZap] Send message. It works with both WhatsApp Web and official lines.',
          action: '[ThinkZap] Send message',
        },
        {
          screen: 'robot-form',
          title: 'Set up the message',
          description:
            'Choose the line, the destination phone (a CRM field) and the text, which can include deal and contact fields.',
          action: 'Save',
        },
        ROBOS_MOVE,
        {
          screen: 'result',
          title: 'The message goes out on its own',
          description:
            "The customer gets it on WhatsApp and the send is logged in the deal's timeline. If it isn't delivered, the timeline lets you know.",
          action: 'Open chat',
        },
      ],
      done: {
        title: 'Automation is live',
        description:
          'Reminders, confirmations and follow-ups without anyone typing. Ready to automate your pipeline?',
      },
    },
    {
      key: 'template',
      label: 'Send template (official API)',
      summary:
        'A Meta-approved template sent automatically when a deal changes stage.',
      steps: [
        ...ROBOS_OPEN,
        {
          screen: 'catalog-template',
          title: 'Pick the template robot',
          description:
            'In the Add window, search for "thinkzap" and click Add next to [ThinkZap] Send Template. It sends through your official WhatsApp line.',
          action: '[ThinkZap] Send Template',
        },
        {
          screen: 'template-form',
          title: 'Choose a line and a template',
          description:
            'Choose the official line and an approved template. Each variable gets a CRM field, and the preview shows how the message will arrive.',
          action: 'Save',
        },
        ROBOS_MOVE,
        {
          screen: 'result-template',
          title: 'The template goes out on its own',
          description:
            "Because it's an approved template, the message is delivered even outside the 24-hour window. The send is logged in the deal's timeline, and Meta charges for each template.",
          action: 'Open chat',
        },
      ],
      done: {
        title: 'Automatic templates are live',
        description:
          'Confirmations and reminders through the official API, without anyone typing. Ready to automate your pipeline?',
      },
    },
  ],
}

export const ROBOS_EN: RobosCopy = {
  tutorial,
  screens: {
    robots: {
      message: '[ThinkZap] Send message',
      template: '[ThinkZap] Send Template',
    },
    board: {
      extensions: 'Extensions',
      rules: 'Automation rules',
      otherDeals: [
        {
          title: 'Office renovation',
          contact: 'Rafael Souza',
          value: 'R$ 8,900.00',
        },
        { title: 'Annual plan', contact: 'Ana Prado', value: 'R$ 12,000.00' },
      ],
    },
    stages: {
      title: 'Automation rules · Deals',
      hint: 'Robots run when a deal enters the stage.',
    },
    catalog: {
      title: 'Add',
      toStage: 'to stage',
      search: 'thinkzap',
      group: 'Group',
      newRules: 'New automation rules and triggers',
      recent: 'Recent items',
      groups: {
        products: 'Products',
        tasks: 'Task management',
        data: 'Data storage and modification',
        workflow: 'Workflow automation',
        other: 'Other',
      },
      market: 'Market',
      rules: 'Automation rules and triggers',
      help: 'Help',
      templateDescription:
        'Sends an approved official WhatsApp template through the selected line',
      add: 'Add',
    },
    robotForm: {
      connector: 'Connector',
      connectorValue: 'Line 1 (WhatsApp Web)',
      destination: 'Destination',
      destinationValue: '{{Contact: Phone}}',
      sendToAll: 'Send to all related contacts',
      sendToAllValue: 'No',
      message: 'Message',
      messageValue:
        "Hi, {{Contact: Name}}! We've emailed you our proposal. Any questions, just reply here.",
      runWhen: (stage: string) =>
        `Run: when the deal enters the "${stage}" stage`,
      cancel: 'Cancel',
    },
    templateForm: {
      line: 'Official WhatsApp line',
      lineValue: 'Line 2',
      template: 'Template',
      templateValue: 'proposal_sent (en_US)',
      sendToAll: 'Send to all related contacts',
      sendToAllWarning:
        'Every recipient found gets a template, and Meta charges for each one.',
      destination: 'Destination',
      destinationField: 'Contact: Phone',
      variable: 'Variable {{1}}',
      variableField: 'Contact: Name',
      preview: 'Message preview',
      previewText:
        "Hi {Contact: Name}! We've emailed you our proposal. If you have any questions, reply to this message.",
      change: 'Change',
      cancel: 'Cancel',
    },
    result: {
      dealStage: (id: number, stage: string) => `Deal #${id} · ${stage} stage`,
      history: 'History',
      sentTitle: 'ThinkZap · message sent to WhatsApp',
      robotLine: (robot: string) => `Robot "${robot}" · just now`,
      openChat: 'Open chat',
      stageChanged: (from: string, to: string) =>
        `Stage changed: ${from} → ${to}`,
      store: 'Acme Store',
      sent: {
        message:
          "Hi, Maria! We've emailed you our proposal. Any questions, just reply here.",
        template:
          "Hi Maria! We've emailed you our proposal. If you have any questions, reply to this message.",
      },
    },
  },
}
