import z from 'zod'

/** O que o SDK `@omnizapi/connect` devolve e as duas rotas de conexão recebem. */
export const officialConnectionFields = {
  wabaId: z.string().min(1),
  phoneId: z.string().default(''),
  code: z.string().min(1),
  /** Ausente (tela anterior ao campo) = sem coexistência. */
  coexistence: z.boolean().default(false),
}

/**
 * Número que continua no app WhatsApp Business pode terminar a autenticação sem o id
 * do telefone; fora desse modo, sem ele o retorno está incompleto.
 */
export const hasRequiredPhoneId = (body: {
  phoneId: string
  coexistence: boolean
}): boolean => body.coexistence || body.phoneId.length > 0

export const PHONE_ID_REQUIRED = 'phoneId é obrigatório sem coexistência'
