// Dados novos achatam o `.code` em string; dados antigos vêm como `{ code }`,
// então pickCode tolera ambos.
export function pickCode(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string') return value
  if (typeof value === 'object' && 'code' in value) {
    const code = (value as { code?: unknown }).code
    return typeof code === 'string' ? code : null
  }
  return null
}

export interface GroupParticipante {
  contato?: string | null
  campo_usuario?: string | null
  email?: string | null
  cpf?: string | null
  parte?: unknown // code do "assinar como"
  grupo?: unknown // code do grupo de assinatura
  has_documentation?: boolean
}

export interface GroupContato {
  contato_padrao?: boolean
  contato?: string | null
  contato_nome?: string | null
  contato_email?: string | null
  contato_cpf?: string | null
  contato_group?: number | string | null
}

export interface ClicksignGroup {
  id: string
  arquivo?: unknown
  data_limite?: unknown
  clicksign_id?: unknown
  contato_assinado?: unknown
  processo_finalizado?: unknown
  arquivo_assinado?: unknown
  data_assinatura?: unknown
  participantes?: GroupParticipante[]
  contatos?: GroupContato[]
}

export interface EmpresaToken {
  name: string
  token: string
  ambiente: 'prod' | 'sandbox'
  pasta?: string
  lembrete: string
}

export interface ClicksignFields {
  tokens: EmpresaToken[]
  lembrete?: string
}

export interface VerifySettings {
  selfie_enabled?: boolean
  facial_biometrics_enabled?: boolean
  handwritten_enabled?: boolean
  official_document_enabled?: boolean
  rubrica?: boolean
}

export interface ContactSettings {
  documentation?: unknown // code (string) ou { code }
  has_document?: unknown
  part?: { name?: string; code?: string }
}
