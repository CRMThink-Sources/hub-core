import { describe, expect, it } from 'vitest'
import { buildRequirements, RequirementSigner } from './build-requirements'
import type { VerifySettings } from './clicksign-settings.types'

const signer: RequirementSigner = {
  signerId: 's1',
  signAs: 'parte',
  communicateBy: 'email',
}

const noFlags: VerifySettings = {
  selfie_enabled: false,
  facial_biometrics_enabled: false,
  handwritten_enabled: false,
  official_document_enabled: false,
  rubrica: false,
}

describe('buildRequirements', () => {
  it('emite os dois mínimos (agree + provide_evidence pelo canal do token)', () => {
    const reqs = buildRequirements({
      documentId: 'doc',
      signers: [signer],
      verifySettings: noFlags,
    })

    expect(reqs).toEqual([
      { documentId: 'doc', signerId: 's1', action: 'agree', role: 'parte' },
      {
        documentId: 'doc',
        signerId: 's1',
        action: 'provide_evidence',
        auth: 'email',
      },
    ])
  })

  it('usa o canal do token como auth base (sms/whatsapp)', () => {
    const reqs = buildRequirements({
      documentId: 'doc',
      signers: [{ ...signer, communicateBy: 'whatsapp' }],
      verifySettings: noFlags,
    })
    expect(reqs[1]).toMatchObject({ action: 'provide_evidence', auth: 'whatsapp' })
  })

  it('adiciona cada evidência condicional à verify_settings', () => {
    const reqs = buildRequirements({
      documentId: 'doc',
      signers: [signer],
      verifySettings: {
        selfie_enabled: true,
        facial_biometrics_enabled: true,
        handwritten_enabled: true,
        official_document_enabled: true,
        rubrica: true,
      },
    })

    const auths = reqs
      .filter(r => r.action === 'provide_evidence')
      .map(r => r.auth)
    expect(auths).toEqual([
      'email',
      'official_document',
      'handwritten',
      'selfie',
      'facial_biometrics',
    ])
    expect(reqs.some(r => r.action === 'rubricate' && r.pages === 'all')).toBe(
      true,
    )
  })

  it('repete o conjunto por signer (multi-signer)', () => {
    const reqs = buildRequirements({
      documentId: 'doc',
      signers: [signer, { ...signer, signerId: 's2', signAs: 'outra' }],
      verifySettings: noFlags,
    })
    expect(reqs).toHaveLength(4)
    expect(reqs.filter(r => r.signerId === 's2')).toHaveLength(2)
  })
})
