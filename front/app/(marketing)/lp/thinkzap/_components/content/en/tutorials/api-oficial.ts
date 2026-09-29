import type { ApiOficialCopy } from '../../pt/tutorials/api-oficial'

export const API_OFICIAL_EN: ApiOficialCopy = {
  tutorial: {
    slug: 'api-oficial',
    label: 'Official API and templates',
    summary:
      'A line on the official WhatsApp API, a Meta-approved template and sending from the CRM.',
    steps: [
      {
        screen: 'lines',
        title: 'Create a new line',
        description: 'In Connections, click New line.',
        action: 'New line',
      },
      {
        screen: 'new-line',
        title: 'Choose Official WhatsApp',
        description:
          "Select the Official WhatsApp connector (Meta's channel, with a verified number and templates) and the plan.",
        action: 'Create line',
      },
      {
        screen: 'pending-line',
        title: 'Open the new line',
        description:
          'It shows up as Awaiting connection. Click it to open its settings.',
        action: 'Open the line',
      },
      {
        screen: 'connect',
        title: 'Connect the number with Meta',
        description:
          'On the Connection tab, click Connect number. Meta opens the sign-in for your WhatsApp Business account, and that is where you pick the number.',
        action: 'Connect number',
      },
      {
        screen: 'connected',
        title: 'Number connected',
        description:
          'The line is now tied to your WhatsApp Business Account (WABA) and templates start working. Open the Templates tab.',
        action: 'Templates',
      },
      {
        screen: 'templates',
        title: 'Create a template',
        description:
          'Templates are Meta-approved messages for starting conversations outside the 24h window. Click New template.',
        action: 'New template',
      },
      {
        screen: 'template-form',
        title: 'Write it and submit for approval',
        description:
          'Name, category, language and body. {{1}} is replaced with customer data at send time, and Meta asks for an example of each variable.',
        action: 'Submit for approval',
      },
      {
        screen: 'template-pending',
        title: 'Wait for approval',
        description:
          'The template stays Pending until Meta reviews it. Sync fetches the latest status.',
        action: 'Sync',
      },
      {
        screen: 'crm-send',
        title: 'Send from the CRM',
        description:
          'In the deal, open the ThinkZap tab and pick the official line, the number and the template. The same template can also go out through an automation rule or a Bitrix24 SMS campaign.',
        action: 'Send',
      },
    ],
    done: {
      title: 'Template sent through the official API',
      description:
        'Verified number, approved template and sending without leaving the CRM. Ready to connect yours?',
    },
  },
  screens: {
    lineName: 'Line 2',
    lines: {
      newLine: 'New line',
      planSubtitle: 'Monthly plan',
      statusActive: 'Active',
      statusPending: 'Awaiting connection',
    },
    newLine: {
      title: 'Create a new line',
      description:
        'Choose the connector type for the new line. Billing is adjusted on your current subscription.',
      oficialLabel: 'Official WhatsApp',
      planLabel: 'Choose a plan',
      planValue: 'Official · month',
      cancel: 'Cancel',
    },
    connection: {
      title: 'Connection',
      description: "Connect this line's number to your Meta account.",
      instructions:
        'When you connect, Meta opens the sign-in for your WhatsApp Business account. At the end, the number is tied to this line and templates start working.',
      connectedBanner: 'Number connected.',
      connectedDescription: 'This line is connected to the Official WhatsApp.',
      wabaLabel: 'WhatsApp Business Account (WABA)',
      connectedHint: "To change this line's number, contact support.",
    },
    templates: {
      title: 'Templates',
      description:
        'Meta-approved message templates to start conversations outside the 24h window.',
      sync: 'Sync',
      newTemplate: 'New template',
      empty: 'No templates registered yet.',
      pending: 'Pending',
    },
    template: {
      name: 'order_confirmation',
      category: 'Utility',
      language: 'en_US',
      body: 'Hi {{1}}, your order is confirmed.',
      sample: 'Maria',
      footer: 'Acme Store',
    },
    templateForm: {
      nameLabel: 'Template name',
      categoryLabel: 'Category',
      languageLabel: 'Language',
      bodyLabel: 'Message body',
      exampleLabel: 'Example for {{1}}',
      footerLabel: 'Footer (optional)',
      cancel: 'Cancel',
    },
    crmSend: {
      lineLabel: 'Line',
      recipientLabel: 'Recipient',
      templateLabel: 'Template',
      approved: 'Approved',
      previewBefore: 'Hi ',
      previewAfter: ', your order is confirmed.',
    },
  },
}
