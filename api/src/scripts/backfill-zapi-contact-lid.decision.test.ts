import { describe, expect, it } from 'vitest'

import {
  decideBackfill,
  isPhoneLike,
} from './backfill-zapi-contact-lid.decision'

const ok = { exists: true, lid: '3577724534928@lid' }

describe('isPhoneLike', () => {
  it('aceita telefone em dígitos', () => {
    expect(isPhoneLike('5511999999999')).toBe(true)
  })

  it('rejeita lid e jid de grupo', () => {
    expect(isPhoneLike('3577724534928@lid')).toBe(false)
    expect(isPhoneLike('5511999999999-group')).toBe(false)
  })

  it('rejeita valor curto ou longo demais para telefone', () => {
    expect(isPhoneLike('1234567')).toBe(false)
    expect(isPhoneLike('1234567890123456')).toBe(false)
  })
})

describe('decideBackfill', () => {
  /**
   * `chat_id` que já é LID não precisa de identidade legada: o LID **é** a chave que a
   * resolução vai produzir, então nada muda para esse contato quando a flag ligar.
   */
  it('pula chat_id que já é lid', () => {
    expect(
      decideBackfill({
        chatId: '3577724534928@lid',
        hasLegacyIdentity: false,
        phoneExists: ok,
      }),
    ).toEqual({ kind: 'skip-not-phone' })
  })

  it('pula grupo', () => {
    expect(
      decideBackfill({
        chatId: '5511999999999-group',
        hasLegacyIdentity: false,
        phoneExists: ok,
      }).kind,
    ).toBe('skip-not-phone')
  })

  /** A idempotência: rodar de novo não sobrescreve o que já foi marcado. */
  it('não remarca contato que já tem identidade legada', () => {
    expect(
      decideBackfill({
        chatId: '5511999999999',
        hasLegacyIdentity: true,
        phoneExists: ok,
      }),
    ).toEqual({ kind: 'already-mapped' })
  })

  /**
   * Falha de consulta é diferente de "não tem WhatsApp", e a diferença importa: a
   * primeira precisa de outra passada antes de ligar a flag, a segunda não.
   */
  it('marca como falha quando a consulta não respondeu', () => {
    expect(
      decideBackfill({
        chatId: '5511999999999',
        hasLegacyIdentity: false,
        phoneExists: null,
      }),
    ).toEqual({ kind: 'failed' })
  })

  it('marca como sem WhatsApp quando exists é false', () => {
    expect(
      decideBackfill({
        chatId: '5511999999999',
        hasLegacyIdentity: false,
        phoneExists: { exists: false, lid: null },
      }),
    ).toEqual({ kind: 'not-on-whatsapp' })
  })

  it('marca como sem WhatsApp quando exists é true mas não veio lid', () => {
    expect(
      decideBackfill({
        chatId: '5511999999999',
        hasLegacyIdentity: false,
        phoneExists: { exists: true, lid: null },
      }).kind,
    ).toBe('not-on-whatsapp')
  })

  /** O caso que o backfill existe para produzir. */
  it('mapeia telefone com lid resolvido', () => {
    expect(
      decideBackfill({
        chatId: '5511999999999',
        hasLegacyIdentity: false,
        phoneExists: ok,
      }),
    ).toEqual({
      kind: 'map',
      lid: '3577724534928@lid',
      phone: '5511999999999',
    })
  })
})
