import { axiosThinkzap } from '@/infra/client/axios-thinkzap'
import { APP_CODES } from '@/shared/app/app-codes'
import { appTokenKey } from '@/shared/auth/app-token-storage'

/**
 * Grava no servidor o idioma escolhido no menu, para a instalação.
 *
 * O idioma da tela vive no navegador (`setLocale`); este é o que o servidor usa nos
 * avisos que ele gera sozinho — limite diário no chat do canal aberto e na timeline.
 * Vale a última escolha explícita de qualquer usuário da instalação.
 *
 * Nunca lança: a troca de idioma da tela já aconteceu, e falhar aqui só deixa os
 * avisos do servidor no idioma anterior.
 */
export async function saveInstallationLocale(locale: string): Promise<void> {
  try {
    await axiosThinkzap(appTokenKey(APP_CODES.thinkzap)).put<{
      locale: string
    }>('/thinkzap/locale', { locale })
  } catch {
    // Sem aviso na tela: o idioma da interface mudou, que é o que o usuário pediu.
  }
}
