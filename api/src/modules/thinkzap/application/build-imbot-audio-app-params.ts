import { env } from '@/config/env'
import { IMBOT_AUDIO_ICON_FILE_BASE64 } from './imbot-audio-icon'

export type ImbotAudioAppRegisterParams = {
  BOT_ID: number
  CODE: string
  IFRAME: string
  HASH: string
  CONTEXT: 'LINES'
  ICON_FILE: string
  IFRAME_WIDTH: string
  IFRAME_HEIGHT: string
  IFRAME_POPUP: string
  LANG: Array<{ LANGUAGE_ID: string; TITLE: string }>
}

export function buildImbotAudioAppParams(
  botId: number,
): ImbotAudioAppRegisterParams {
  const title = env.bitrix.iframeAudio.name

  return {
    BOT_ID: botId,
    CODE: env.bitrix.iframeAudio.code,
    IFRAME: env.bitrix.iframeAudio.url,
    HASH: env.bitrix.iframeAudio.hash,
    CONTEXT: 'LINES',
    ICON_FILE: IMBOT_AUDIO_ICON_FILE_BASE64,
    IFRAME_WIDTH: '400',
    IFRAME_HEIGHT: '320',
    IFRAME_POPUP: 'Y',
    LANG: [
      { LANGUAGE_ID: 'pt', TITLE: title },
      { LANGUAGE_ID: 'en', TITLE: title },
      { LANGUAGE_ID: 'es', TITLE: title },
    ],
  }
}
