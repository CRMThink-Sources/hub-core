import { describe, expect, it } from 'vitest'
import pt from '@/messages/pt/admin/status.json'
import en from '@/messages/en/admin/status.json'
import es from '@/messages/es/admin/status.json'
import {
  APP_STATUS,
  LINE_STATUS,
  MIRROR_STATUS,
  MODALITY_LABEL,
  PROVIDER_BILLING_STATUS,
  SUBSCRIPTION_STATUS,
  modalityLabelKey,
  statusMeta,
} from './portal-status'

/** Lê `a.b` num objeto aninhado; chave com hífen (`no-mirror`) é segmento inteiro. */
const lookup = (messages: unknown, key: string): unknown =>
  key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object'
          ? (node as Record<string, unknown>)[part]
          : undefined,
      messages,
    )

const ALL_KEYS = [
  ...Object.values(SUBSCRIPTION_STATUS).map(meta => meta.labelKey),
  ...Object.values(APP_STATUS).map(meta => meta.labelKey),
  ...Object.values(MIRROR_STATUS).map(meta => meta.labelKey),
  ...Object.values(PROVIDER_BILLING_STATUS).map(meta => meta.labelKey),
  ...Object.values(LINE_STATUS).map(meta => meta.labelKey),
  ...Object.values(MODALITY_LABEL),
  'unknown',
]

describe('portal-status', () => {
  it('cobre todo valor dos enums da api', () => {
    expect(Object.keys(SUBSCRIPTION_STATUS).sort()).toEqual(
      ['active', 'cancelled', 'past_due', 'trial_expired', 'trialing'].sort(),
    )
    expect(Object.keys(APP_STATUS).sort()).toEqual(
      ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'TRIAL'].sort(),
    )
    expect(Object.keys(MIRROR_STATUS).sort()).toEqual(
      ['linked', 'mirror-missing', 'no-mirror', 'unknown'].sort(),
    )
    expect(Object.keys(PROVIDER_BILLING_STATUS).sort()).toEqual(
      ['subscribed', 'unknown', 'unsubscribed'].sort(),
    )
  })

  it.each([
    ['pt', pt],
    ['en', en],
    ['es', es],
  ])('toda chave de rótulo existe em %s, como texto', (_locale, messages) => {
    for (const key of ALL_KEYS) {
      expect(typeof lookup(messages, key), key).toBe('string')
    }
  })

  it('valor fora do mapa cai em desconhecido neutro, nunca no valor cru', () => {
    expect(statusMeta(SUBSCRIPTION_STATUS, 'paused')).toEqual({
      tone: 'neutral',
      labelKey: 'unknown',
    })
    expect(modalityLabelKey('boleto')).toBe('unknown')
  })

  it('vencido é atenção e cancelado é falha', () => {
    expect(statusMeta(SUBSCRIPTION_STATUS, 'past_due').tone).toBe('warning')
    expect(statusMeta(SUBSCRIPTION_STATUS, 'cancelled').tone).toBe('danger')
    expect(statusMeta(MIRROR_STATUS, 'mirror-missing').tone).toBe('danger')
  })
})
