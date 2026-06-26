import type { AddRequirementInput } from '../domain/entities/requirement'
import type { CommunicateBy } from '../domain/entities/signer'
import type { VerifySettings } from './clicksign-settings.types'

export interface RequirementSigner {
  signerId: string
  signAs: string
  communicateBy: CommunicateBy
}

// Mínimos por signer: `agree` + `provide_evidence` (token). Os demais evidence
// são condicionais às verify_settings.
export function buildRequirements(input: {
  documentId: string
  signers: RequirementSigner[]
  verifySettings: VerifySettings
}): AddRequirementInput[] {
  const { documentId, signers, verifySettings: v } = input
  const requirements: AddRequirementInput[] = []

  for (const signer of signers) {
    const base = { documentId, signerId: signer.signerId }

    requirements.push({ ...base, action: 'agree', role: signer.signAs })
    requirements.push({
      ...base,
      action: 'provide_evidence',
      auth: signer.communicateBy,
    })

    if (v.rubrica) {
      requirements.push({ ...base, action: 'rubricate', pages: 'all' })
    }
    if (v.official_document_enabled) {
      requirements.push({
        ...base,
        action: 'provide_evidence',
        auth: 'official_document',
      })
    }
    if (v.handwritten_enabled) {
      requirements.push({
        ...base,
        action: 'provide_evidence',
        auth: 'handwritten',
      })
    }
    if (v.selfie_enabled) {
      requirements.push({ ...base, action: 'provide_evidence', auth: 'selfie' })
    }
    // Custa R$1,50 por biometria bem-sucedida.
    if (v.facial_biometrics_enabled) {
      requirements.push({
        ...base,
        action: 'provide_evidence',
        auth: 'facial_biometrics',
      })
    }
  }

  return requirements
}
