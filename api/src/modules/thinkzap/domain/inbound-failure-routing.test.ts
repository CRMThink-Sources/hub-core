import { describe, expect, it } from 'vitest'
import {
  describeInboundPayload,
  extractInboundRouting,
  isReprocessableInboundSource,
  previousFailureIdOf,
  reprocessJobId,
} from './inbound-failure-routing'

describe('extractInboundRouting', () => {
  it('z-api: lê o id da instância na Z-API', () => {
    expect(extractInboundRouting('z-api', { instanceId: 'ZAPI-1' })).toEqual({
      zApiInstanceId: 'ZAPI-1',
    })
  })

  it('hubmessage e hubmessage-status: leem o canal', () => {
    expect(extractInboundRouting('hubmessage', { channel_id: 'C-9' })).toEqual({
      channelId: 'C-9',
    })
    expect(
      extractInboundRouting('hubmessage-status', { channel_id: 'C-9' }),
    ).toEqual({ channelId: 'C-9' })
  })

  it('bitrix: lê o nome do portal em auth.domain', () => {
    expect(
      extractInboundRouting('bitrix', {
        auth: { domain: 'acme.bitrix24.com' },
      }),
    ).toEqual({ domainName: 'acme.bitrix24.com' })
  })

  it('bitrix-bot: lê o nome do portal em domain', () => {
    expect(
      extractInboundRouting('bitrix-bot', { domain: 'acme.bitrix24.com' }),
    ).toEqual({ domainName: 'acme.bitrix24.com' })
  })

  it('apara espaços e ignora valores vazios', () => {
    expect(extractInboundRouting('z-api', { instanceId: '  Z1 ' })).toEqual({
      zApiInstanceId: 'Z1',
    })
    expect(extractInboundRouting('z-api', { instanceId: '   ' })).toEqual({})
  })

  /** O body vem de fora: lixo não pode esconder a falha original. */
  it.each([null, undefined, 'texto', 42, [], { instanceId: 7 }])(
    'não lança com body malformado (%o)',
    body => {
      expect(() => extractInboundRouting('z-api', body)).not.toThrow()
      expect(extractInboundRouting('z-api', body)).toEqual({})
    },
  )

  it('origem desconhecida não identifica ninguém', () => {
    expect(extractInboundRouting('outra', { instanceId: 'Z1' })).toEqual({})
  })
})

describe('isReprocessableInboundSource', () => {
  it('só o hubmessage é reprocessável (idempotência provada)', () => {
    expect(isReprocessableInboundSource('hubmessage')).toBe(true)
  })

  it.each(['z-api', 'hubmessage-status', 'bitrix', 'bitrix-bot', 'outra'])(
    'não libera %s',
    source => {
      expect(isReprocessableInboundSource(source)).toBe(false)
    },
  )
})

const FAILURE_ID = '3f1c8a52-7b0e-4d27-9a31-5c2e6f0b1d44'

describe('reprocessJobId / previousFailureIdOf', () => {
  it('o jobId do reprocesso carrega a falha de origem e volta nela', () => {
    expect(previousFailureIdOf(reprocessJobId(FAILURE_ID, 1))).toBe(FAILURE_ID)
    expect(previousFailureIdOf(reprocessJobId(FAILURE_ID, 12))).toBe(FAILURE_ID)
  })

  it('não é o jobId de um evento comum', () => {
    expect(reprocessJobId(FAILURE_ID, 1)).not.toBe('42')
  })

  it.each([
    '42',
    'widget-send-abc',
    'reprocess-abc-1',
    `reprocess-${FAILURE_ID}`,
  ])('job comum (%s) não aponta para falha nenhuma', jobId => {
    expect(previousFailureIdOf(jobId)).toBeNull()
  })
})

describe('describeInboundPayload', () => {
  it('z-api: só a instância e o id da mensagem, sem telefone nem texto', () => {
    const fields = describeInboundPayload('z-api', {
      instanceId: 'ZAPI-1',
      messageId: 'ABC',
      phone: '5511999999999',
      text: { message: 'segredo' },
      senderName: 'Maria',
    })

    expect(fields).toEqual({ instanceId: 'ZAPI-1', messageId: 'ABC' })
  })

  it('hubmessage e status: canal e id da mensagem', () => {
    const body = { channel_id: 'C-9', _id: 'm-1', sender: { identifier: '55' } }
    expect(describeInboundPayload('hubmessage', body)).toEqual({
      channelId: 'C-9',
      messageId: 'm-1',
    })
    expect(describeInboundPayload('hubmessage-status', body)).toEqual({
      channelId: 'C-9',
      messageId: 'm-1',
    })
  })

  it('bitrix: portal e linha, aceitando a linha numérica', () => {
    expect(
      describeInboundPayload('bitrix', {
        auth: { domain: 'acme.bitrix24.com', access_token: 'SEGREDO' },
        data: { LINE: 12, MESSAGES: [{ message: { text: 'oi' } }] },
      }),
    ).toEqual({ domain: 'acme.bitrix24.com', line: '12' })
  })

  it('bitrix-bot: só o portal', () => {
    expect(
      describeInboundPayload('bitrix-bot', {
        domain: 'acme.bitrix24.com',
        authorName: 'João',
      }),
    ).toEqual({ domain: 'acme.bitrix24.com' })
  })

  it('nunca devolve objetos nem credenciais', () => {
    const fields = describeInboundPayload('bitrix', {
      auth: { domain: { nested: true }, access_token: 'SEGREDO' },
      data: {},
    })

    expect(JSON.stringify(fields)).not.toContain('SEGREDO')
    expect(fields).toEqual({})
  })

  it.each([null, undefined, 'x', 5])(
    'body malformado (%o) devolve vazio',
    body => {
      expect(describeInboundPayload('z-api', body)).toEqual({})
    },
  )

  it('origem desconhecida devolve vazio', () => {
    expect(describeInboundPayload('outra', { instanceId: 'Z1' })).toEqual({})
  })
})
