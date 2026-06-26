export type ClicksignEnv = 'prod' | 'sandbox'

export type EnvelopeStatus = 'running' | 'canceled'

export interface ClicksignResource {
  id: string
  status?: string
  links?: { self?: string }
}

export interface CreateEnvelopeInput {
  name: string
  remindInterval?: string | number
  deadlineAt?: string
}

export interface AddDocumentInput {
  filename: string
  // data-URL base64: `data:<mime>;base64,...`.
  contentBase64: string
}
