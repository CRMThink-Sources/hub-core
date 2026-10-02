import type { AtivacaoCopy } from '../../pt/tutorials/ativacao'

export const ATIVACAO_EN: AtivacaoCopy = {
  tutorial: {
    slug: 'ativacao',
    label: 'Activation',
    summary:
      'Free trial, first line, QR code and the link to the open channel.',
    steps: [
      {
        screen: 'trial',
        title: 'Start the 3-day free trial',
        description:
          'ThinkZap opens on Connections. Pick the connector type — here, WhatsApp Web, which connects with a QR code.',
        action: 'Start trial',
      },
      {
        screen: 'contact',
        title: 'Confirm your contact details',
        description:
          'Your details come straight from Bitrix24. Review them and activate the trial — your first line is created right away.',
        action: 'Activate trial',
      },
      {
        screen: 'lines',
        title: 'Open the new line',
        description:
          'The new line shows up in the connections list. Click it to open its settings.',
        action: 'Open the line',
      },
      {
        screen: 'qrcode',
        title: 'Scan the QR code with your phone',
        description:
          'On the Connection tab, open WhatsApp for that number, go to Linked devices → Link a device and point it at the code.',
        action: 'Simulate scanning the QR code',
      },
      {
        screen: 'connected',
        title: 'Number connected',
        description:
          'The line switches to Connected and shows the device details. One thing left: choose which Bitrix24 channel the conversations go to. Open the Settings tab.',
        action: 'Settings',
      },
      {
        screen: 'channel',
        title: 'Link it to an open channel',
        description:
          'Pick the Bitrix24 open channel that receives this line’s conversations — this link is what delivers messages to the CRM.',
        action: 'Link',
      },
      {
        screen: 'chat',
        title: 'Reply from Bitrix24',
        description:
          'Messages arrive in the open channel chat, linked to the contact in the CRM. Your team replies without leaving Bitrix24.',
        action: 'Send reply',
      },
    ],
    done: {
      title: 'Done! Your WhatsApp is in Bitrix24',
      description:
        'That’s it: activate, connect and reply. Want to do it on your own portal?',
    },
  },
  screens: {
    trial: {
      title: 'Try ThinkZap for 3 days',
      description:
        'Pick a connector type to create your first line. The trial is one per installation and lasts 3 days.',
      oficialLabel: 'Official WhatsApp',
      start: 'Start trial',
    },
    contact: {
      title: 'Confirm your contact details',
      description:
        'We use these details to reach you during the trial. Review and correct them if needed.',
      fields: [
        { label: 'Your name', value: 'Jane Miller' },
        { label: 'Email', value: 'jane@company.com' },
        { label: 'Phone', value: '+1 415 555 1234' },
        { label: 'Company', value: 'Acme Inc.' },
      ],
      cancel: 'Cancel',
    },
    lines: {
      trialTitle: 'Trial in progress',
      trialDescription:
        'Your trial runs until Friday. After that the line stays visible but stops sending and receiving messages.',
      rowSubtitle: 'Trial period',
      rowStatus: 'Active',
    },
    line: {
      device: 'Connected device: Jane Miller',
      connectionTitle: 'Connection',
    },
    qrcode: {
      description: 'Scan the QR code with the WhatsApp of this line’s number.',
      instruction:
        'In WhatsApp: Linked devices → Link a device, then point at the code.',
      refresh: 'Refresh QR code',
    },
    connected: {
      description: 'This line is connected to WhatsApp.',
      initials: 'JM',
      fields: [
        { label: 'Name', value: 'Jane Miller' },
        { label: 'Phone', value: '+1 415 555 1234' },
        { label: 'Device', value: 'iPhone' },
        { label: 'Account', value: 'Business' },
      ],
      disconnectHint:
        'Disconnecting ends this line’s WhatsApp session. The subscription is not affected.',
      disconnect: 'Disconnect',
    },
    channel: {
      title: 'Bitrix open channel',
      description: 'This link is what delivers messages to the CRM.',
      empty:
        'No channel linked. Without a link, messages do not reach the CRM.',
      selected: 'Sales',
      behaviorTitle: 'Behavior',
      prefixLabel: 'Prefix operator name',
      prefixHint: 'Adds the agent name before the sent message.',
      openChannelLabel: 'Send to open channel',
      openChannelHint: 'Link an open channel to enable.',
    },
    chat: {
      chats: [
        { name: 'Maria Clara', detail: 'WhatsApp · Sales' },
        { name: 'Rafael Souza', detail: 'WhatsApp · Sales' },
      ],
      title: 'Maria Clara',
      subtitle: 'WhatsApp · Sales channel · Contact in CRM',
      incoming: 'Hi! I saw your ad. Do you have a slot tomorrow?',
      reply: 'We do, Maria! 10 AM or 3 PM?',
    },
  },
}
