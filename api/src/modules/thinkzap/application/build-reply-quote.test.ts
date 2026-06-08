import { describe, expect, it } from 'vitest'
import {
  buildMessageTextWithReply,
  buildReplyQuote,
  extractQuoteInput,
  sanitizeQuoteText,
  truncate,
  ThinkzapMessageQuoteInput,
} from './build-reply-quote'
import { ReceivedMessageEvent } from '@/shared/infra/handlers/z-api/z-api'

function makeEvent(
  overrides: Partial<ReceivedMessageEvent> = {},
): ReceivedMessageEvent {
  return {
    notification: '',
    isStatusReply: false,
    chatLid: null,
    connectedPhone: '',
    waitingMessage: false,
    isEdit: false,
    isGroup: false,
    isNewsletter: false,
    instanceId: 'inst-1',
    messageId: 'msg-1',
    phone: '5511999999999',
    fromMe: false,
    momment: 0,
    status: '',
    chatName: '',
    senderPhoto: '',
    senderName: '',
    photo: '',
    broadcast: false,
    participantPhone: '',
    participantLid: null,
    editMessageId: '',
    messageExpirationSeconds: 0,
    forwarded: false,
    type: 'ReceivedCallback',
    fromApi: false,
    _traceContext: { traceId: '', spanId: '' },
    ...overrides,
  } as ReceivedMessageEvent
}

describe('sanitizeQuoteText', () => {
  it('replaces \\n and \\r with single space', () => {
    expect(sanitizeQuoteText('linha1\nlinha2\rlinha3')).toBe(
      'linha1 linha2 linha3',
    )
  })

  it('trims surrounding whitespace', () => {
    expect(sanitizeQuoteText('  hello  ')).toBe('hello')
  })
})

describe('truncate', () => {
  it('returns text unchanged when within limit', () => {
    expect(truncate('hello', 10)).toBe('hello')
  })

  it('truncates and adds ellipsis when exceeds limit', () => {
    const long = 'a'.repeat(200)
    const result = truncate(long, 120)
    expect(result.length).toBe(120)
    expect(result.endsWith('…')).toBe(true)
  })
})

describe('buildReplyQuote', () => {
  it('returns null when cached is null', () => {
    expect(buildReplyQuote(null)).toBeNull()
  })

  it('builds quote for text message', () => {
    const cached: ThinkzapMessageQuoteInput = { type: 'TEXT', text: 'Bom dia' }
    expect(buildReplyQuote(cached)).toBe('>>Bom dia')
  })

  it('truncates long text', () => {
    const cached: ThinkzapMessageQuoteInput = {
      type: 'TEXT',
      text: 'a'.repeat(200),
    }
    const quote = buildReplyQuote(cached)!
    expect(quote.startsWith('>>')).toBe(true)
    expect(quote.endsWith('…')).toBe(true)
    expect(quote.length).toBe(2 + 120)
  })

  it('sanitizes newlines in text', () => {
    const cached: ThinkzapMessageQuoteInput = {
      type: 'TEXT',
      text: 'linha1\nlinha2',
    }
    expect(buildReplyQuote(cached)).toBe('>>linha1 linha2')
  })

  it('builds quote for image with caption', () => {
    const cached: ThinkzapMessageQuoteInput = {
      type: 'IMAGE',
      text: 'Foto do recibo',
    }
    expect(buildReplyQuote(cached)).toBe('>>📷 Imagem: Foto do recibo')
  })

  it('builds quote for image without caption', () => {
    const cached: ThinkzapMessageQuoteInput = { type: 'IMAGE' }
    expect(buildReplyQuote(cached)).toBe('>>📷 Imagem')
  })

  it('builds quote for video with caption', () => {
    const cached: ThinkzapMessageQuoteInput = { type: 'VIDEO', text: 'topo' }
    expect(buildReplyQuote(cached)).toBe('>>🎥 Vídeo: topo')
  })

  it('builds quote for video without caption', () => {
    expect(buildReplyQuote({ type: 'VIDEO' })).toBe('>>🎥 Vídeo')
  })

  it('builds quote for audio', () => {
    expect(buildReplyQuote({ type: 'AUDIO' })).toBe('>>🎧 Áudio')
  })

  it('builds quote for document with fileName', () => {
    const cached: ThinkzapMessageQuoteInput = {
      type: 'DOCUMENT',
      fileName: 'contrato.pdf',
    }
    expect(buildReplyQuote(cached)).toBe('>>📎 contrato.pdf')
  })

  it('builds quote for document without fileName', () => {
    expect(buildReplyQuote({ type: 'DOCUMENT' })).toBe('>>📎 Documento')
  })

  it('builds context link when bitrixMessageId and bitrixChatId present', () => {
    const cached: ThinkzapMessageQuoteInput = {
      type: 'TEXT',
      text: 'Olá',
      bitrixMessageId: '456',
      bitrixChatId: '1767',
    }
    expect(buildReplyQuote(cached)).toBe('>>[context=chat1767/456]Olá[/context]')
  })

  it('builds plain quote when only bitrixMessageId present (no chatId)', () => {
    const cached: ThinkzapMessageQuoteInput = {
      type: 'TEXT',
      text: 'Olá',
      bitrixMessageId: '456',
    }
    expect(buildReplyQuote(cached)).toBe('>>Olá')
  })

  it('builds plain quote when only bitrixChatId present (no messageId)', () => {
    const cached: ThinkzapMessageQuoteInput = {
      type: 'TEXT',
      text: 'Olá',
      bitrixChatId: '1767',
    }
    expect(buildReplyQuote(cached)).toBe('>>Olá')
  })

  it('builds context link for media type with bitrix ids', () => {
    const cached: ThinkzapMessageQuoteInput = {
      type: 'IMAGE',
      text: 'foto',
      bitrixMessageId: '789',
      bitrixChatId: '42',
    }
    expect(buildReplyQuote(cached)).toBe('>>[context=chat42/789]📷 Imagem: foto[/context]')
  })
})

describe('buildMessageTextWithReply', () => {
  it('passthrough when referenceMessageId is absent', () => {
    const event = makeEvent({ referenceMessageId: undefined })
    expect(
      buildMessageTextWithReply({
        event,
        cached: null,
        baseText: 'Olá',
      }),
    ).toBe('Olá')
  })

  it('uses generic fallback when referenceMessageId present but cached is null', () => {
    const event = makeEvent({ referenceMessageId: 'X' })
    expect(
      buildMessageTextWithReply({
        event,
        cached: null,
        baseText: 'Bom dia',
      }),
    ).toBe('>>↩ Resposta a mensagem anterior\nBom dia')
  })

  it('prefixes quote when cached snapshot exists', () => {
    const event = makeEvent({ referenceMessageId: 'X' })
    expect(
      buildMessageTextWithReply({
        event,
        cached: { type: 'TEXT', text: 'Olá' },
        baseText: 'Tudo bem?',
      }),
    ).toBe('>>Olá\nTudo bem?')
  })

  it('preserves group sender prefix after quote', () => {
    const event = makeEvent({ referenceMessageId: 'X' })
    const baseText = '[b]Maria[/b]:\nOK'
    expect(
      buildMessageTextWithReply({
        event,
        cached: { type: 'TEXT', text: 'Bom dia' },
        baseText,
      }),
    ).toBe('>>Bom dia\n[b]Maria[/b]:\nOK')
  })
})

describe('extractQuoteInput', () => {
  it('extracts text', () => {
    const event = makeEvent({ text: { message: 'hello' } })
    expect(extractQuoteInput(event)).toEqual({ type: 'TEXT', text: 'hello' })
  })

  it('extracts image with caption', () => {
    const event = makeEvent({
      image: {
        imageUrl: '',
        thumbnailUrl: '',
        caption: 'cap',
        mimeType: '',
        viewOnce: false,
        height: 0,
        width: 0,
      },
    })
    expect(extractQuoteInput(event)).toEqual({ type: 'IMAGE', text: 'cap' })
  })

  it('extracts image without caption', () => {
    const event = makeEvent({
      image: {
        imageUrl: '',
        thumbnailUrl: '',
        caption: '',
        mimeType: '',
        viewOnce: false,
        height: 0,
        width: 0,
      },
    })
    expect(extractQuoteInput(event)).toEqual({ type: 'IMAGE' })
  })

  it('extracts video with caption', () => {
    const event = makeEvent({
      video: {
        videoUrl: '',
        caption: 'cap',
        mimeType: '',
        width: 0,
        height: 0,
        seconds: 0,
        viewOnce: false,
        isGif: false,
      },
    })
    expect(extractQuoteInput(event)).toEqual({ type: 'VIDEO', text: 'cap' })
  })

  it('extracts audio', () => {
    const event = makeEvent({
      audio: {
        ptt: false,
        seconds: 0,
        audioUrl: '',
        mimeType: '',
        viewOnce: false,
      },
    })
    expect(extractQuoteInput(event)).toEqual({ type: 'AUDIO' })
  })

  it('extracts document with fileName', () => {
    const event = makeEvent({
      document: {
        documentUrl: '',
        fileName: 'contrato.pdf',
        mimeType: '',
      },
    })
    expect(extractQuoteInput(event)).toEqual({
      type: 'DOCUMENT',
      fileName: 'contrato.pdf',
    })
  })

  it('falls back to empty text when nothing matches', () => {
    const event = makeEvent({})
    expect(extractQuoteInput(event)).toEqual({ type: 'TEXT', text: '' })
  })
})
