import type { BitrixInstallBind } from '@/shared/domain/bitrix-install-bind'
import { env } from '@/config/env'

export function buildImTextareaAudioBind(): BitrixInstallBind {
  const title = env.bitrix.iframeAudio.name

  return {
    method: 'placement.bind',
    params: {
      PLACEMENT: 'IM_TEXTAREA',
      HANDLER: env.bitrix.iframeAudio.url,
      TITLE: title,
      LANG_ALL: {
        pt: { TITLE: title },
        en: { TITLE: title },
        es: { TITLE: title },
      },
      OPTIONS: {
        iconName: 'fa-microphone',
        context: 'LINES',
        role: 'USER',
        color: 'GREEN',
        extranet: 'N',
      },
    },
  }
}
