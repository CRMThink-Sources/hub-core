import { buildWhatsappLink } from '@/shared/whatsapp/build-whatsapp-link'

export type LpCtas = {
  marketUrl: string | null
  whatsappLink: string | null
}

// Env vazia vira `null` para o botão sumir em vez de apontar para lugar nenhum.
export function resolveLpCtas(env: {
  marketUrl: string
  salesWhatsapp: string
  whatsappMessage: string
}): LpCtas {
  return {
    marketUrl: env.marketUrl.trim() || null,
    whatsappLink: buildWhatsappLink(env.salesWhatsapp, env.whatsappMessage),
  }
}
