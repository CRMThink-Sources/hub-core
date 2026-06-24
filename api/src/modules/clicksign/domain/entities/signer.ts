export type CommunicateBy = 'email' | 'sms' | 'whatsapp'

export interface AddSignerInput {
  name: string
  email: string
  hasDocumentation: boolean
  refusable: boolean
  group: number | string
  communicateBy: CommunicateBy
  documentation?: string
}
