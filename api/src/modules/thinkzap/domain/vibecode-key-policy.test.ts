import { describe, expect, it } from 'vitest'
import {
  REQUIRED_VIBECODE_SCOPES,
  evaluateVibecodeMe,
  type VibecodeMe,
} from './vibecode-key-policy'

const INSTALLED = 'https://ACME.bitrix24.com.br/'

function validMe(overrides: Partial<VibecodeMe> = {}): VibecodeMe {
  return {
    type: 'personal',
    portal: 'acme.bitrix24.com.br',
    scopes: [...REQUIRED_VIBECODE_SCOPES],
    accessMode: 'READONLY',
    ...overrides,
  }
}

describe('evaluateVibecodeMe', () => {
  it('aceita chave personal READONLY, portal igual e escopos exatos', () => {
    expect(evaluateVibecodeMe(validMe(), INSTALLED)).toEqual({ ok: true })
  })

  it('recusa escopo a mais', () => {
    const verdict = evaluateVibecodeMe(
      validMe({ scopes: [...REQUIRED_VIBECODE_SCOPES, 'task'] }),
      INSTALLED,
    )
    expect(verdict).toEqual({
      ok: false,
      reasons: [{ code: 'EXTRA_SCOPES', scopes: ['task'] }],
    })
  })

  it('recusa escopo faltando', () => {
    const verdict = evaluateVibecodeMe(
      validMe({
        scopes: REQUIRED_VIBECODE_SCOPES.filter(s => s !== 'department'),
      }),
      INSTALLED,
    )
    expect(verdict).toEqual({
      ok: false,
      reasons: [{ code: 'MISSING_SCOPES', scopes: ['department'] }],
    })
  })

  it('recusa READWRITE', () => {
    const verdict = evaluateVibecodeMe(
      validMe({ accessMode: 'READWRITE' }),
      INSTALLED,
    )
    expect(verdict).toEqual({
      ok: false,
      reasons: [{ code: 'NOT_READONLY' }],
    })
  })

  it("recusa type 'management'", () => {
    const verdict = evaluateVibecodeMe(
      validMe({ type: 'management' }),
      INSTALLED,
    )
    expect(verdict).toEqual({ ok: false, reasons: [{ code: 'WRONG_TYPE' }] })
  })

  it('recusa portal diferente', () => {
    const verdict = evaluateVibecodeMe(
      validMe({ portal: 'outro.bitrix24.com.br' }),
      INSTALLED,
    )
    expect(verdict).toEqual({ ok: false, reasons: [{ code: 'WRONG_PORTAL' }] })
  })

  it('acumula todos os motivos', () => {
    const verdict = evaluateVibecodeMe(
      {
        type: 'management',
        portal: 'outro.bitrix24.com.br',
        scopes: ['crm', 'task'],
        accessMode: 'READWRITE',
      },
      INSTALLED,
    )
    expect(verdict.ok).toBe(false)
    if (verdict.ok) return
    const codes = verdict.reasons.map(r => r.code).sort()
    expect(codes).toEqual([
      'EXTRA_SCOPES',
      'MISSING_SCOPES',
      'NOT_READONLY',
      'WRONG_PORTAL',
      'WRONG_TYPE',
    ])
  })
})
