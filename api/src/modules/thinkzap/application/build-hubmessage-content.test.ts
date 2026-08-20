import { describe, expect, it } from 'vitest'
import { buildHubMessageContent } from './build-hubmessage-content'
import type {
  HubMessageAttachment,
  HubMessageContent,
  HubMessageWebhookMessage,
} from '@/modules/thinkzap/domain/interfaces/hubmessage-events.interface'

function makeMessage(
  overrides: {
    contents?: HubMessageContent[]
    attachments?: HubMessageAttachment[]
  } = {},
): HubMessageWebhookMessage {
  return {
    _id: '019F5D201EAA795BA7B46A820C7CA289',
    channel_id: '019F5CC904597D81817829E11B7679F2',
    chat_id: '019F5CC904597D81817829E11B7679F2=15553840789',
    created: 1783973813930,
    metadata: { from_me: false, moment: 1783973812000 },
    sender: { identifier: '554792259475', name: 'Romuca' },
    recipient: { identifier: '15553840789' },
    contents: overrides.contents ?? [],
    attachments: overrides.attachments ?? [],
  }
}

describe('buildHubMessageContent', () => {
  it('extracts TEXT from contents', () => {
    const result = buildHubMessageContent(
      makeMessage({
        contents: [{ type: 'TEXT', message: 'Outra msg de teste' }],
      }),
    )

    expect(result).toEqual({ text: 'Outra msg de teste', type: 'TEXT' })
    expect(result?.files).toBeUndefined()
  })

  it('extracts IMAGE with caption as text', () => {
    const result = buildHubMessageContent(
      makeMessage({
        attachments: [
          {
            type: 'IMAGE',
            url: 'https://exemplo.com/imagem.png',
            caption: 'Confira nossa linha',
          },
        ],
      }),
    )

    expect(result?.type).toBe('IMAGE')
    expect(result?.text).toBe('Confira nossa linha')
    expect(result?.files).toEqual([
      { url: 'https://exemplo.com/imagem.png', name: 'Imagem' },
    ])
  })

  it('extracts IMAGE without caption with empty text', () => {
    const result = buildHubMessageContent(
      makeMessage({
        attachments: [{ type: 'IMAGE', url: 'https://exemplo.com/i.png' }],
      }),
    )

    expect(result?.type).toBe('IMAGE')
    expect(result?.text).toBe('')
    expect(result?.files?.[0]?.url).toBe('https://exemplo.com/i.png')
  })

  it('extracts AUDIO with empty text', () => {
    const result = buildHubMessageContent(
      makeMessage({
        attachments: [{ type: 'AUDIO', url: 'https://exemplo.com/audio.mp3' }],
      }),
    )

    expect(result).toEqual({
      text: '',
      type: 'AUDIO',
      fileName: 'Mensagem de áudio.mp3',
      files: [
        { url: 'https://exemplo.com/audio.mp3', name: 'Mensagem de áudio.mp3' },
      ],
    })
  })

  it('extracts VIDEO with caption', () => {
    const result = buildHubMessageContent(
      makeMessage({
        attachments: [
          {
            type: 'VIDEO',
            url: 'https://exemplo.com/video.mp4',
            caption: 'Assista',
          },
        ],
      }),
    )

    expect(result?.type).toBe('VIDEO')
    expect(result?.text).toBe('Assista')
  })

  it('extracts STICKER', () => {
    const result = buildHubMessageContent(
      makeMessage({
        attachments: [
          { type: 'STICKER', url: 'https://exemplo.com/sticker.webp' },
        ],
      }),
    )

    expect(result?.type).toBe('STICKER')
    expect(result?.files).toEqual([
      { url: 'https://exemplo.com/sticker.webp', name: 'Sticker.webp' },
    ])
  })

  it('uses file_name of a DOCUMENT attachment when present', () => {
    const result = buildHubMessageContent(
      makeMessage({
        attachments: [
          {
            type: 'DOCUMENT',
            url: 'https://exemplo.com/contrato.pdf',
            file_name: 'contrato.pdf',
          },
        ],
      }),
    )

    expect(result?.type).toBe('DOCUMENT')
    expect(result?.fileName).toBe('contrato.pdf')
    expect(result?.files).toEqual([
      { url: 'https://exemplo.com/contrato.pdf', name: 'contrato.pdf' },
    ])
  })

  it('formats CONTACT_ARRAY with name and phones', () => {
    const result = buildHubMessageContent(
      makeMessage({
        contents: [
          {
            type: 'CONTACT_ARRAY',
            contacts: [{ name: 'Ryan Andrade', phones: ['5544997294496'] }],
          },
        ],
      }),
    )

    expect(result?.type).toBe('CONTACT')
    expect(result?.text).toContain('Ryan Andrade')
    expect(result?.text).toContain('5544997294496')
  })

  it('turns INTERACTIVE_BUTTON into text with button titles', () => {
    const result = buildHubMessageContent(
      makeMessage({
        contents: [
          {
            type: 'INTERACTIVE_BUTTON',
            message: 'Como foi sua experiência?',
            buttons: [
              { id: '1', title: 'Ótimo', type: 'BUTTON' },
              { id: '2', title: 'Bom', type: 'BUTTON' },
            ],
          },
        ],
      }),
    )

    expect(result?.type).toBe('TEXT')
    expect(result?.text).toContain('Como foi sua experiência?')
    expect(result?.text).toContain('Ótimo')
    expect(result?.text).toContain('Bom')
  })

  it('turns INTERACTIVE_ACTION buttons into url and phone lines', () => {
    const result = buildHubMessageContent(
      makeMessage({
        contents: [
          {
            type: 'INTERACTIVE_ACTION',
            message: 'Como podemos ajudar?',
            buttons: [
              {
                id: '1',
                title: 'Visite nosso site',
                type: 'URL',
                url: 'https://www.hubmessage.io',
              },
              {
                id: '2',
                title: 'Fale conosco',
                type: 'CALL',
                phone: '5544997294496',
              },
            ],
          },
        ],
      }),
    )

    expect(result?.text).toContain('https://www.hubmessage.io')
    expect(result?.text).toContain('5544997294496')
  })

  it('prefers the attachment when contents and attachments coexist', () => {
    const result = buildHubMessageContent(
      makeMessage({
        contents: [{ type: 'TEXT', message: 'ignorado' }],
        attachments: [
          {
            type: 'IMAGE',
            url: 'https://exemplo.com/i.png',
            caption: 'legenda',
          },
        ],
      }),
    )

    expect(result?.type).toBe('IMAGE')
    expect(result?.text).toBe('legenda')
  })

  it('returns null when nothing is supported', () => {
    expect(buildHubMessageContent(makeMessage())).toBeNull()

    const unknownContent = [
      { type: 'LOCATION', message: 'x' },
    ] as unknown as HubMessageContent[]
    expect(
      buildHubMessageContent(makeMessage({ contents: unknownContent })),
    ).toBeNull()
  })

  it('ignores attachment without url', () => {
    const attachments = [
      { type: 'IMAGE', url: '' },
    ] as unknown as HubMessageAttachment[]

    expect(buildHubMessageContent(makeMessage({ attachments }))).toBeNull()
  })
})
