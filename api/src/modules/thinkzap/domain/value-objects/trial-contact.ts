import { z } from 'zod'
import { SpaClientContact } from '@/shared/domain/entities/spa-client-contact'
import {
  isValidZApiPhoneNumber,
  normalizePhoneNumber,
} from '@/shared/helpers/normalize-phone-number'

/**
 * Contato informado na ativação do trial, já validado e normalizado.
 *
 * Existe como value object e não como schema solto no controller porque a
 * **normalização do telefone** faz parte do dado: o que é gravado no CRM é o
 * número em E.164, não o que o cliente digitou. Um telefone que ninguém consegue
 * discar não é dado, é ruído — e o comercial descobriria isso na hora de ligar.
 *
 * O caso de uso recebe `TrialContact` e não string crua: assim não existe caminho
 * que grave contato sem passar por aqui.
 */

/** Campo que reprovou a validação, para a resposta nomear o que corrigir. */
export type TrialContactField = 'name' | 'email' | 'phone' | 'company'

export class InvalidTrialContactError extends Error {
  constructor(
    readonly field: TrialContactField,
    reason: string,
  ) {
    super(`Contato inválido: ${reason}`)
    this.name = 'InvalidTrialContactError'
  }
}

/**
 * Nome e empresa com `trim()` **antes** do mínimo: `"   "` tem 3 caracteres e
 * passaria por um `min` aplicado no valor cru.
 *
 * O telefone fica fora do schema de propósito — `zod` valida forma, e telefone
 * aqui é transformação (normalizar) seguida de validação sobre o **resultado**.
 * Misturar as duas coisas num `refine` esconderia que o valor gravado não é o
 * recebido.
 */
const schema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  phone: z.string(),
  company: z.string().trim().min(1),
})

const MESSAGES: Record<TrialContactField, string> = {
  name: 'informe o nome de quem vai usar o teste (mínimo 2 caracteres)',
  email: 'informe um e-mail válido',
  phone: 'informe um telefone válido, com DDD',
  company: 'informe o nome da empresa',
}

export function parseTrialContact(raw: unknown): SpaClientContact {
  const parsed = schema.safeParse(raw)

  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0] as
      | TrialContactField
      | undefined

    const named = field ?? 'name'
    throw new InvalidTrialContactError(named, MESSAGES[named])
  }

  const phone = normalizePhoneNumber(parsed.data.phone)

  if (!isValidZApiPhoneNumber(phone)) {
    throw new InvalidTrialContactError('phone', MESSAGES.phone)
  }

  return {
    name: parsed.data.name,
    email: parsed.data.email,
    phone,
    company: parsed.data.company,
  }
}
