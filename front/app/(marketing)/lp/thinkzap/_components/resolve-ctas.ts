import { buildWhatsappLink } from '@/shared/whatsapp/build-whatsapp-link'
import { WHATSAPP_MESSAGE } from './content'

export type ThinkzapCtas = {
  /** Página do app no Bitrix24 Market; `null` esconde "Instalar no Bitrix24". */
  marketUrl: string | null
  /** Link `wa.me` do comercial; `null` esconde "Falar no WhatsApp". */
  whatsappLink: string | null
}

/**
 * Destinos dos CTAs a partir das envs. Env vazia vira `null` — o botão some em
 * vez de apontar para lugar nenhum.
 */
export function resolveThinkzapCtas(env: {
  marketUrl: string
  salesWhatsapp: string
}): ThinkzapCtas {
  return {
    marketUrl: env.marketUrl.trim() || null,
    whatsappLink: buildWhatsappLink(env.salesWhatsapp, WHATSAPP_MESSAGE),
  }
}
