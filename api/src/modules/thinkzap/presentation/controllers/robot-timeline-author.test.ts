import { describe, expect, it } from 'vitest'
import { robotTimelineAuthor } from './robot-timeline-author'

describe('robotTimelineAuthor', () => {
  it('usa o usuário do auth e nomeia o remetente no idioma da instalação', () => {
    const author = robotTimelineAuthor('7', 'en')

    expect(author.authorBitrixUserId).toBe('7')
    expect(author.senderLine?.('Ana')).toBe('[B]Sent by:[/B] Ana')
  })

  it.each([undefined, '', '  ', '0', 0])(
    'sem usuário útil (%s): sem autor',
    id => {
      expect(robotTimelineAuthor(id, 'pt')).toEqual({})
    },
  )
})
