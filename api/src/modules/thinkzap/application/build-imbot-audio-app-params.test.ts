import { describe, expect, it } from 'vitest'
import { env } from '@/config/env'
import { buildImbotAudioAppParams } from './build-imbot-audio-app-params'

describe('buildImbotAudioAppParams', () => {
  it('builds imbot.app.register params for Open Lines', () => {
    const params = buildImbotAudioAppParams(99)

    expect(params.BOT_ID).toBe(99)
    expect(params.CODE).toBe(env.bitrix.iframeAudio.code)
    expect(params.CONTEXT).toBe('LINES')
    expect(params.IFRAME).toBe(env.bitrix.iframeAudio.url)
    expect(params.HASH).toBe(env.bitrix.iframeAudio.hash)
    expect(params.ICON_FILE.length).toBeGreaterThan(0)
    expect(params.IFRAME_POPUP).toBe('Y')
  })
})
