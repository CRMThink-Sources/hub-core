export type RequirementAction = 'agree' | 'rubricate' | 'provide_evidence'

export type RequirementAuth =
  | 'email'
  | 'sms'
  | 'whatsapp'
  | 'official_document'
  | 'handwritten'
  | 'selfie'
  | 'facial_biometrics'

export interface AddRequirementInput {
  documentId: string
  signerId: string
  action: RequirementAction
  role?: string
  pages?: 'all'
  auth?: RequirementAuth
}
