import type { GruposCopy } from '../../pt/tutorials/grupos'

export const GRUPOS_EN: GruposCopy = {
  tutorial: {
    slug: 'grupos',
    label: 'WhatsApp groups',
    summary:
      'Create groups from Bitrix24 and handle group conversations in the Open Channel.',
    steps: [
      {
        screen: 'groups-tab',
        title: 'Open the Groups tab',
        description:
          'In the settings of a connected WhatsApp Web line, open Groups. Groups are only available on WhatsApp Web lines.',
        action: 'Groups',
      },
      {
        screen: 'groups-list',
        title: 'Create a group',
        description: "The list shows the number's groups. Click New group.",
        action: 'New group',
      },
      {
        screen: 'group-form',
        title: 'Name and participants',
        description:
          'Search for contacts in Bitrix24 and tick their phone numbers, or type a number manually.',
        action: 'Add selected',
      },
      {
        screen: 'group-ready',
        title: 'Create the group',
        description:
          "Anyone who can't be added directly can get a private invite instead.",
        action: 'Create group',
      },
      {
        screen: 'group-created',
        title: 'Group created',
        description:
          'The group is already live on WhatsApp. Copy the invitation link to bring more people in.',
        action: 'Copy link',
      },
      {
        screen: 'group-chat',
        title: 'Chat through the Open Channel',
        description:
          "Each group becomes a conversation in the line's Open Channel, with the sender's name in bold. Your reply goes to the group.",
        action: 'Send',
      },
    ],
    done: {
      title: 'Groups in Bitrix24',
      description:
        'Customer, partner or team groups, handled alongside everything else. Want to try it on your portal?',
    },
  },
  screens: {
    common: {
      device: 'Connected device: Joana Silva',
      groupName: 'VIP Customers',
    },
    groupsTab: {
      description: 'This line is connected to WhatsApp.',
      phoneLine: 'Phone +55 11 99999-8888 · iPhone · Business',
    },
    groupsList: {
      title: 'WhatsApp groups',
      colName: 'Name',
      colLastActivity: 'Last activity',
      colActions: 'Actions',
      sampleGroup: 'Sales team',
      sampleLastActivity: 'yesterday',
      rowActions: 'Edit · Leave',
    },
    groupForm: {
      title: 'New group',
      backToList: '← Back to list',
      nameLabel: 'Group name',
      participants: 'Participants',
      searchContact: 'Search Bitrix contact',
      searchQuery: 'Maria',
      selectPhones: 'Select phone number(s)',
      addedParticipants: 'Added participants',
      autoInvite:
        'Send private invite to participants who cannot be added directly',
      create: 'Create group',
    },
    groupCreated: {
      success: 'Group created successfully!',
      inviteLabel: 'Invitation link',
      copyLink: 'Copy link',
      createAnother: 'Create another group',
      viewInList: 'View in list',
    },
    groupChat: {
      groupDetail: 'WhatsApp group · Sales',
      otherChatDetail: 'WhatsApp · Sales',
      subtitle: 'WhatsApp group · Sales channel',
      messages: [
        {
          author: 'Maria Clara',
          text: "Hi everyone! When's the new collection coming out?",
        },
        { author: 'Rafael Souza', text: 'I want to know too 👀' },
      ],
      reply: "On Monday! You'll get the catalog here first.",
    },
  },
}
