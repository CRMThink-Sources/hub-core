import type { NoticeLocale } from './notice-locale'

/**
 * Textos que o servidor acrescenta ao histórico do canal aberto ao espelhar um envio do
 * CRM, por idioma. O pt é o texto que já existia.
 */
export type HistoryNotices = {
  /** Vai antes da mensagem, com a quebra de linha já incluída. */
  sentFromCrmPrefix: string
  /**
   * Vai antes da mensagem disparada por uma automação (robô do Bizproc), sem operador por
   * trás. Distinto do prefixo do CRM para quem lê o histórico saber que ninguém digitou
   * aquilo. Quebra de linha já incluída.
   */
  sentFromAutomationPrefix: string
  /**
   * Antes da mensagem que o cliente enviou do próprio aparelho (celular ou WhatsApp
   * Web), espelhada no canal aberto. Quebra de linha já incluída.
   */
  sentFromDevicePrefix: string
  attachment: Record<'image' | 'video' | 'audio' | 'file', string>
}

const NOTICES: Record<NoticeLocale, HistoryNotices> = {
  pt: {
    sentFromCrmPrefix: '[Mensagem enviada a partir do CRM]\n',
    sentFromAutomationPrefix: '[Mensagem enviada por automação]\n',
    sentFromDevicePrefix: '[Mensagem enviada pelo WhatsApp do aparelho]\n',
    attachment: {
      image: '[Imagem enviada]',
      video: '[Vídeo enviado]',
      audio: '[Áudio enviado]',
      file: '[Arquivo enviado]',
    },
  },
  en: {
    sentFromCrmPrefix: '[Message sent from the CRM]\n',
    sentFromAutomationPrefix: '[Message sent by automation]\n',
    sentFromDevicePrefix: "[Message sent from the device's WhatsApp]\n",
    attachment: {
      image: '[Image sent]',
      video: '[Video sent]',
      audio: '[Audio sent]',
      file: '[File sent]',
    },
  },
  es: {
    sentFromCrmPrefix: '[Mensaje enviado desde el CRM]\n',
    sentFromAutomationPrefix: '[Mensaje enviado por automatización]\n',
    sentFromDevicePrefix:
      '[Mensaje enviado desde el WhatsApp del dispositivo]\n',
    attachment: {
      image: '[Imagen enviada]',
      video: '[Video enviado]',
      audio: '[Audio enviado]',
      file: '[Archivo enviado]',
    },
  },
}

export function historyNotices(locale: NoticeLocale): HistoryNotices {
  return NOTICES[locale]
}
