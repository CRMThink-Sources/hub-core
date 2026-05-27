import { describe, expect, it } from 'vitest'
import { env } from '@/config/env'
import { buildImTextareaAudioBind } from './bind-im-textarea-audio'

describe('buildImTextareaAudioBind', () => {
  it('returns placement.bind for IM_TEXTAREA with audio widget handler', () => {
    const bind = buildImTextareaAudioBind()

    expect(bind.method).toBe('placement.bind')
    expect(bind.params).toEqual({
      PLACEMENT: 'IM_TEXTAREA',
      HANDLER: env.bitrix.iframeAudio.url,
      TITLE: env.bitrix.iframeAudio.name,
      LANG_ALL: {
        pt: { TITLE: env.bitrix.iframeAudio.name },
        en: { TITLE: env.bitrix.iframeAudio.name },
        es: { TITLE: env.bitrix.iframeAudio.name },
      },
      OPTIONS: {
        iconName: 'fa-microphone',
        context: 'LINES',
        role: 'USER',
        color: 'GREEN',
        extranet: 'N',
      },
    })
  })
})
