export type Option = { code: string; name: string }

export type Ambiente = 'prod' | 'sandbox'

export type Empresa = {
  name: string
  token: string
  ambiente: Ambiente
  pasta: string
  lembrete: string
}

export type VerifySettings = {
  selfie_enabled: boolean
  facial_biometrics_enabled: boolean
  handwritten_enabled: boolean
  official_document_enabled: boolean
  rubrica: boolean
}

export type ContactSettings = {
  documentation: string | null
  has_document: string | null
  part: { name: string; code: string }
}

export type Contato = {
  contato_padrao: boolean
  contato: string | null
  contato_nome: string | null
  contato_email: string | null
  contato_cpf: string | null
  contato_group: number | null
}

export type Participante = {
  contato: string | null
  campo_usuario: string | null
  email: string | null
  cpf: string | null
  parte: string | null
  grupo: number | null
  has_documentation: boolean
}

export type Grupo = {
  id: string | null
  contato_assinado: string | null
  data_assinatura: string | null
  arquivo: string | null
  arquivo_assinado: string | null
  clicksign_id: string | null
  data_limite: string | null
  processo_finalizado: string | null
  observations: string | null
  contatos: Contato[]
  participantes: Participante[]
}
