import { env } from '@/config/env'

export type AudioImTextareaPlacementOptions = {
  iconName: string
  context: string
  role: string
  extranet: string
  color: string
  width: string
  height: string
}

export type AudioImTextareaPlacementBindParams = {
  PLACEMENT: 'IM_TEXTAREA'
  HANDLER: string
  TITLE: string
  LANG_ALL: Record<string, { TITLE: string }>
  OPTIONS: AudioImTextareaPlacementOptions
}

export function buildAudioImTextareaPlacementBindParams(): AudioImTextareaPlacementBindParams {
  const title = env.bitrix.iframeAudio.name
  const handler = env.bitrix.iframeAudio.url

  return {
    PLACEMENT: 'IM_TEXTAREA',
    HANDLER: handler,
    TITLE: title,
    LANG_ALL: {
      pt: { TITLE: title },
      en: { TITLE: title },
      es: { TITLE: title },
      ru: { TITLE: title },
    },
    OPTIONS: {
      iconName: 'chat-compose',
      context: 'LINES',
      role: 'USER',
      extranet: 'N',
      color: 'GREEN',
      width: '400',
      height: '320',
    },
  }
}
