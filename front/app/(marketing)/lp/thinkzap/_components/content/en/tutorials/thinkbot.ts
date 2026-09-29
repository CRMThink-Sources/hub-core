import type { ThinkbotCopy } from '../../pt/tutorials/thinkbot'

export const THINKBOT_EN: ThinkbotCopy = {
  tutorial: {
    slug: 'thinkbot',
    label: 'ThinkBot',
    summary:
      'Build a chatbot that serves customers on the open channel and hands off to an agent when needed.',
    steps: [
      {
        screen: 'empty',
        title: 'Open ThinkBot',
        description:
          'In the ThinkZap menu, click ThinkBot. With no flows yet, start with Create flow.',
        action: 'Create flow',
      },
      {
        screen: 'new-flow',
        title: 'Name your flow',
        description:
          'The name only identifies the flow in here — the customer never sees it.',
        action: 'Create',
      },
      {
        screen: 'editor',
        title: 'The flow starts with a welcome',
        description:
          'Every flow is born with a welcome block. Click the + on its output to say what comes next.',
        action: 'Add next step',
      },
      {
        screen: 'kind-menu',
        title: 'Pick the interaction',
        description:
          'Message, question with options, data capture, condition, transfer or ending — plus ready-made blocks that look up the CRM. Here, a Question.',
        action: 'Question',
      },
      {
        screen: 'block-panel',
        title: 'Write the question and the options',
        description:
          'Each option leads to a block. "Support" goes to a Transfer block, which hands the conversation to the open channel queue. Then test it in the simulator.',
        action: 'simulator',
      },
      {
        screen: 'simulator-start',
        title: 'Test before publishing',
        description:
          'The simulator runs the flow as if you were the customer on WhatsApp. Nothing is sent to anyone.',
        action: 'Start conversation',
      },
      {
        screen: 'simulator-chat',
        title: 'Reply as the customer',
        description:
          'The bot sent the welcome and the question. Reply "Support" to see the transfer.',
        action: 'Send',
      },
      {
        screen: 'publish',
        title: 'It works: publish it',
        description:
          'The conversation was handed to an agent, as planned. Publish the flow — if something is wrong with it, publishing is refused and the editor shows you where.',
        action: 'Publish',
      },
      {
        screen: 'bind',
        title: 'Choose where it serves',
        description:
          'Back on the list, pick the Bitrix24 open channel under "Serves on" and activate it. It works on any open channel, with any connection type.',
        action: 'activate',
      },
      {
        screen: 'bot-chat',
        title: 'The bot serves customers in Bitrix24',
        description:
          'Every new message on the channel goes through the flow. When the customer asks for support, the conversation goes to the queue and an agent takes it from there.',
        action: 'Send',
      },
    ],
    done: {
      title: 'Your ThinkBot is live',
      description:
        'The bot does the triage and your team steps in only when needed. Ready to build yours?',
    },
  },
  screens: {
    list: {
      title: 'ThinkBot',
      subtitle:
        'Build the service flow: define how the bot should lead the conversation.',
      emptyTitle: 'No flow created',
      create: 'Create flow',
    },
    newFlow: {
      title: 'New flow',
      description: 'Set a name to identify this flow internally.',
      nameLabel: 'Name',
      cancel: 'Cancel',
    },
    bind: {
      inert: (name: string) =>
        `"${name}" is published but still serves no one — pick an open channel under "Serves on".`,
      columns: { flow: 'Flow', status: 'Status', servesOn: 'Serves on' },
      published: 'Published',
      channel: 'Sales',
      activate: 'activate',
    },
    editor: {
      unsaved: 'unsaved',
      newBlock: 'New block',
      rearrange: 'Rearrange',
      tabs: { simulador: 'simulator', ajustes: 'settings' },
      save: 'Save',
      publish: 'Publish',
      legend:
        'Click + to add the next step · click the block to edit · click the line and press Delete to remove',
      problem: 'From this block there is no way to an ending nor to an agent.',
      entry: 'start',
    },
    kinds: {
      message: 'Message',
      question: 'Question',
      input: 'Capture',
      condition: 'Condition',
      handoff: 'Transfer',
      finish: 'End',
    },
    kindMenu: {
      title: 'Which interaction do you want?',
      groups: { conversa: 'Conversation', acoes: 'Chat actions' },
      ready: 'Ready-made',
      recipes: ['Already a customer?', 'Has an open deal?'],
    },
    flow: {
      name: 'General service',
      welcome: "Hi! I'm the automated assistant. How can I help?",
      question: 'What would you like to talk about?',
      handoff: 'Conversation handed to an agent.',
      blocks: {
        welcome: 'Welcome',
        menu: 'Menu',
        agent: 'Agent',
        agentText: 'Open channel queue',
        bye: 'Goodbye',
        byeText: 'See you soon!',
      },
      options: {
        support: { label: 'Support', keywords: 'help, problem' },
        finish: { label: 'End', keywords: 'exit, bye' },
      },
    },
    blockPanel: {
      blockName: 'Block name',
      questionLabel: 'What the bot asks',
      options: 'Options',
      keywords: 'keywords:',
      leadsTo: 'leads to',
      addOption: '+ option',
    },
    simulator: {
      title: 'Simulator',
      notice: 'nothing is sent to the customer',
      empty: 'Run the flow as if you were the customer on WhatsApp.',
      start: 'Start conversation',
      placeholder: 'Customer answer',
    },
    botChat: {
      chats: [
        { name: 'Carlos Lima', detail: 'WhatsApp · Sales' },
        { name: 'Maria Clara', detail: 'WhatsApp · Sales' },
      ],
      title: 'Carlos Lima',
      subtitle: 'WhatsApp · Sales channel · CRM contact',
      incoming: "Hi, my order still hasn't arrived",
      reply: "Hi, Carlos! This is Joana, I'll check on your order right away.",
    },
  },
}
