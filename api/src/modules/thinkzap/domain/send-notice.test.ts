import { describe, expect, it } from 'vitest'
import {
  failureCount,
  isSettled,
  isTrackedSend,
  summarizeRecipients,
  TRACKED_SEND_ORIGINS,
  type SendPart,
} from './send-notice'

function part(overrides: Partial<SendPart> = {}): SendPart {
  return {
    destination: '5511999999999',
    status: 'PENDING',
    rejectedAt: null,
    lastError: null,
    failureCode: null,
    failureReason: null,
    deliveredAt: null,
    readAt: null,
    ...overrides,
  }
}

function stateOf(parts: SendPart[]) {
  return summarizeRecipients(parts)[0]!.state
}

describe('isTrackedSend', () => {
  it('template de campanha de SMS fica fora', () => {
    expect(isTrackedSend({ origin: 'WIDGET', smsMessageId: 'm1' })).toBe(false)
    expect(isTrackedSend({ origin: 'WIDGET', smsMessageId: null })).toBe(true)
    expect(isTrackedSend({ origin: 'OPERATOR', smsMessageId: null })).toBe(
      false,
    )
  })

  it('acompanha widget e robôs', () => {
    for (const origin of TRACKED_SEND_ORIGINS) {
      expect(isTrackedSend({ origin, smsMessageId: null })).toBe(true)
    }
  })

  it('campanha de SMS, canal aberto e bot ficam fora', () => {
    for (const origin of ['SMS_CAMPAIGN', 'OPERATOR', 'BOT']) {
      expect(isTrackedSend({ origin, smsMessageId: null })).toBe(false)
    }
  })
})

describe('summarizeRecipients', () => {
  it('recusa posterior ao aceite vira FAILED', () => {
    const rejected = part({ status: 'SENT', rejectedAt: new Date() })
    const [r] = summarizeRecipients([rejected])
    expect(r!.state).toBe('FAILED')
    expect(r!.failedPart).toBe(rejected)
  })

  it('uma parte saiu e outra falhou é PARTIAL', () => {
    const failed = part({ status: 'FAILED' })
    const [r] = summarizeRecipients([part({ status: 'SENT' }), failed])
    expect(r!.state).toBe('PARTIAL')
    expect(r!.failedPart).toBe(failed)
  })

  it('uma parte saiu e outra foi recusada é PARTIAL', () => {
    expect(
      stateOf([
        part({ status: 'SENT', rejectedAt: new Date() }),
        part({ status: 'SENT' }),
      ]),
    ).toBe('PARTIAL')
  })

  it('falha prevalece sobre parte pendente ou sem confirmação', () => {
    expect(
      stateOf([part({ status: 'FAILED' }), part({ status: 'PENDING' })]),
    ).toBe('FAILED')
    expect(
      stateOf([part({ status: 'UNKNOWN' }), part({ status: 'FAILED' })]),
    ).toBe('FAILED')
  })

  it('aponta a primeira falha, mesmo depois de uma parte sem confirmação', () => {
    const first = part({ status: 'FAILED', failureReason: 'primeira' })
    const [r] = summarizeRecipients([
      part({ status: 'UNKNOWN' }),
      first,
      part({ status: 'FAILED', failureReason: 'segunda' }),
    ])
    expect(r!.failedPart).toBe(first)
  })

  it('sem falha, parte sem confirmação prevalece sobre a pendente', () => {
    const unknown = part({ status: 'UNKNOWN' })
    const [r] = summarizeRecipients([part({ status: 'PENDING' }), unknown])
    expect(r!.state).toBe('UNKNOWN')
    expect(r!.failedPart).toBe(unknown)
  })

  it('espera enquanto houver parte pendente ou saindo', () => {
    for (const status of ['PENDING', 'SENDING'] as const) {
      const [r] = summarizeRecipients([
        part({ status: 'SENT' }),
        part({ status }),
      ])
      expect(r!.state).toBe('WAITING')
      expect(r!.failedPart).toBeNull()
    }
  })

  it('todas as partes entregues ao provider é SENT', () => {
    expect(
      summarizeRecipients([part({ status: 'SENT' }), part({ status: 'SENT' })]),
    ).toEqual([
      {
        destination: '5511999999999',
        state: 'SENT',
        failedPart: null,
        hasUnconfirmed: false,
      },
    ])
  })

  it('parte sem confirmação fica marcada mesmo quando a falha define o estado', () => {
    for (const other of ['FAILED', 'SENT'] as const) {
      const [r] = summarizeRecipients([
        part({ status: 'UNKNOWN' }),
        part({
          status: other,
          rejectedAt: other === 'SENT' ? new Date() : null,
        }),
      ])
      expect(r!.hasUnconfirmed).toBe(true)
    }
    const [partial] = summarizeRecipients([
      part({ status: 'SENT' }),
      part({ status: 'FAILED' }),
      part({ status: 'UNKNOWN' }),
    ])
    expect(partial!.state).toBe('PARTIAL')
    expect(partial!.hasUnconfirmed).toBe(true)
  })

  it('só sem confirmação marca hasUnconfirmed', () => {
    expect(
      summarizeRecipients([part({ status: 'UNKNOWN' })])[0]!.hasUnconfirmed,
    ).toBe(true)
    for (const status of ['PENDING', 'SENDING', 'SENT', 'FAILED'] as const) {
      const [r] = summarizeRecipients([part({ status })])
      expect(r!.hasUnconfirmed).toBe(false)
    }
  })

  it('a marca é por destinatário', () => {
    const summary = summarizeRecipients([
      part({ destination: 'a', status: 'UNKNOWN' }),
      part({ destination: 'b', status: 'SENT' }),
    ])
    expect(summary.map(r => r.hasUnconfirmed)).toEqual([true, false])
  })

  it('agrupa por destino na ordem da primeira aparição', () => {
    const summary = summarizeRecipients([
      part({ destination: 'b', status: 'SENT' }),
      part({ destination: 'a', status: 'FAILED' }),
      part({ destination: 'b', status: 'SENT' }),
    ])
    expect(summary.map(r => [r.destination, r.state])).toEqual([
      ['b', 'SENT'],
      ['a', 'FAILED'],
    ])
  })
})

describe('isSettled', () => {
  it('é falso enquanto houver parte pendente ou saindo', () => {
    for (const status of ['PENDING', 'SENDING'] as const) {
      expect(isSettled([part({ status: 'SENT' }), part({ status })])).toBe(
        false,
      )
    }
  })

  it('é verdadeiro quando a fila terminou todas as partes', () => {
    expect(
      isSettled([
        part({ status: 'SENT' }),
        part({ status: 'FAILED' }),
        part({ status: 'UNKNOWN' }),
      ]),
    ).toBe(true)
  })
})

describe('failureCount', () => {
  it('conta destinatários com falha, falha parcial ou sem confirmação', () => {
    const recipients = summarizeRecipients([
      part({ destination: 'falhou', status: 'FAILED' }),
      part({ destination: 'parcial', status: 'SENT' }),
      part({ destination: 'parcial', status: 'FAILED' }),
      part({ destination: 'incerto', status: 'UNKNOWN' }),
      part({ destination: 'saiu', status: 'SENT' }),
      part({ destination: 'esperando', status: 'PENDING' }),
    ])
    expect(failureCount(recipients)).toBe(3)
  })
})

describe('entregue e lido', () => {
  it('lido sem entregue anterior mostra READ', () => {
    expect(
      summarizeRecipients([part({ status: 'SENT', readAt: new Date() })])[0]!
        .state,
    ).toBe('READ')
  })

  it('entregue em uma parte e só enviada na outra mostra SENT (o menor avanço)', () => {
    const parts = [
      part({ status: 'SENT', deliveredAt: new Date() }),
      part({ status: 'SENT' }),
    ]
    expect(summarizeRecipients(parts)[0]!.state).toBe('SENT')
  })

  it('entregue prevalece sobre recusa registrada', () => {
    const [r] = summarizeRecipients([
      part({
        status: 'SENT',
        rejectedAt: new Date(),
        deliveredAt: new Date(),
      }),
    ])
    expect(r!.state).toBe('DELIVERED')
    expect(r!.failedPart).toBeNull()
  })

  it('recusa sem entrega segue FAILED', () => {
    expect(
      summarizeRecipients([
        part({ status: 'SENT', rejectedAt: new Date() }),
      ])[0]!.state,
    ).toBe('FAILED')
  })

  it('failureCount ignora DELIVERED e READ', () => {
    const recipients = summarizeRecipients([
      part({ destination: 'lido', status: 'SENT', readAt: new Date() }),
      part({
        destination: 'entregue',
        status: 'SENT',
        deliveredAt: new Date(),
      }),
    ])
    expect(failureCount(recipients)).toBe(0)
  })
})
