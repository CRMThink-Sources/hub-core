import { env } from '@/config/env'
import { IMBOT_AUDIO_ICON_FILE_BASE64 } from './imbot-audio-icon'

export type ImbotAudioLangEntry = {
  LANGUAGE_ID: string
  TITLE: string
  DESCRIPTION: string
}

export type ImbotAudioAppFields = {
  IFRAME: string
  HASH: string
  CONTEXT: 'LINES'
  ICON_FILE: string
  IFRAME_WIDTH: string
  IFRAME_HEIGHT: string
  IFRAME_POPUP: string
  EXTRANET_SUPPORT: string
  LIVECHAT_SUPPORT: string
  HIDDEN: string
  LANG: ImbotAudioLangEntry[]
}

export type ImbotAudioAppRegisterParams = ImbotAudioAppFields & {
  BOT_ID: number
  CODE: string
}

export type ImbotAudioAppUpdateParams = {
  APP_ID: number
} & ImbotAudioAppFields

function buildImbotAudioLang(title: string): ImbotAudioLangEntry[] {
  const description = 'Gravar e enviar audio no chat'
  return [
    { LANGUAGE_ID: 'pt', TITLE: title, DESCRIPTION: description },
    { LANGUAGE_ID: 'en', TITLE: title, DESCRIPTION: description },
    { LANGUAGE_ID: 'es', TITLE: title, DESCRIPTION: description },
    { LANGUAGE_ID: 'de', TITLE: title, DESCRIPTION: description },
  ]
}

export function buildImbotAudioAppFields(): ImbotAudioAppFields {
  const title = env.bitrix.iframeAudio.name

  return {
    IFRAME: env.bitrix.iframeAudio.url,
    HASH: env.bitrix.iframeAudio.hash,
    CONTEXT: 'LINES',
    ICON_FILE: IMBOT_AUDIO_ICON_FILE_BASE64,
    IFRAME_WIDTH: '400',
    IFRAME_HEIGHT: '320',
    IFRAME_POPUP: 'Y',
    EXTRANET_SUPPORT: 'N',
    LIVECHAT_SUPPORT: 'Y',
    HIDDEN: 'N',
    LANG: buildImbotAudioLang(title),
  }
}

export function buildImbotAudioAppParams(
  botId: number,
): ImbotAudioAppRegisterParams {
  return {
    BOT_ID: botId,
    CODE: env.bitrix.iframeAudio.code,
    ...buildImbotAudioAppFields(),
  }
}

export function buildImbotAudioAppUpdateParams(
  appId: number,
): ImbotAudioAppUpdateParams {
  return {
    APP_ID: appId,
    ...buildImbotAudioAppFields(),
  }
}
