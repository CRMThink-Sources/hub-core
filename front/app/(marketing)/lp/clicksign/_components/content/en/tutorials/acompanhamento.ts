import type { AcompanhamentoCopy } from '../../pt/tutorials/acompanhamento'

export const ACOMPANHAMENTO_EN: AcompanhamentoCopy = {
  tutorial: {
    slug: 'acompanhamento',
    label: 'Track and cancel',
    summary:
      'Everything comes back to the deal timeline: who signed, the signed PDF, refusals and cancellations.',
    steps: [
      {
        screen: 'sent',
        title: 'Follow it on the card',
        description:
          'The deal timeline shows the [Clicksign] card with the document and the group, the In progress tag and each signer as Waiting.',
        action: 'In progress',
      },
      {
        screen: 'signed',
        title: 'See who has signed',
        description:
          'With each signature, the line of that person turns to Signed.',
        action: 'Signed',
      },
      {
        screen: 'finished',
        title: 'Get the signed document',
        description:
          'When everyone signs, the card turns Completed and the signed PDF is attached to Signed File (up to 25 MB). Signature Status, Signature Date and Process Completed are filled in. The deal does not change stage by itself: if you want, create your own automation based on these fields.',
        action: 'Signed File',
      },
      {
        screen: 'refused',
        title: 'If someone refuses',
        description:
          'If the robot allows refusal, the timeline shows Document refused, with who refused and why, and the card turns Refused.',
        action: 'Document refused',
      },
      {
        screen: 'cancel',
        title: 'Cancel from the card',
        description:
          'Need to call off the sending? Click Cancel document on the card. A completed document can no longer be canceled.',
        action: 'Cancel document',
      },
      {
        screen: 'canceled',
        title: 'Cancellation recorded',
        description:
          'The card turns Canceled and the timeline records Document cancellation, with who canceled it and when.',
        action: 'Document cancellation',
      },
      {
        screen: 'error',
        title: 'If something goes wrong',
        description:
          'When the sending does not happen, the timeline gets a comment starting with [Clicksign] and the reason — for example, Document not attached to the deal. Fix it and run the robot again by moving the deal out of the stage and back.',
        action: 'Clicksign comment',
      },
    ],
    done: {
      title: 'All under control',
      description:
        'From sending to the signed PDF, without leaving Bitrix24. Any questions left? See the FAQ below.',
    },
  },
  screens: {
    refusedLog: {
      title: '[Clicksign] Document refused',
      by: (name, when) => `Refused by ${name} on ${when}`,
      reasons: 'Reason(s): Incorrect data',
      comment: 'Description: The address in the agreement is wrong.',
    },
    canceledLog: {
      title: '[Clicksign] Document cancellation',
      by: (name, when) => `Canceled by ${name} on ${when}`,
    },
    errorComment: '[Clicksign] Document not attached to the deal',
    when: '10/14/2026 10:32',
  },
}
