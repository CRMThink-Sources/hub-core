import { describe, expect, it } from 'vitest'
import { env } from '@/config/env'
import { buildAudioImTextareaPlacementBindParams } from './build-audio-im-textarea-placement-params'

describe('buildAudioImTextareaPlacementBindParams', () => {
  it('builds placement.bind params for IM_TEXTAREA Open Lines', () => {
    const params = buildAudioImTextareaPlacementBindParams()

    expect(params.PLACEMENT).toBe('IM_TEXTAREA')
    expect(params.HANDLER).toBe(env.bitrix.iframeAudio.url)
    expect(params.TITLE).toBe(env.bitrix.iframeAudio.name)
    expect(params.LANG_ALL.pt?.TITLE).toBe(env.bitrix.iframeAudio.name)
    expect(params.OPTIONS).toEqual({
      iconName: 'chat-compose',
      context: 'LINES',
      role: 'USER',
      extranet: 'N',
      color: 'GREEN',
      width: '400',
      height: '320',
    })
  })
})
