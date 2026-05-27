import { describe, expect, it } from 'vitest'
import { env } from '@/config/env'
import {
  buildImbotAudioAppParams,
  buildImbotAudioAppUpdateParams,
} from './build-imbot-audio-app-params'

describe('buildImbotAudioAppParams', () => {
  it('builds imbot.app.register params for Open Lines', () => {
    const params = buildImbotAudioAppParams(99)

    expect(params.BOT_ID).toBe(99)
    expect(params.CODE).toBe(env.bitrix.iframeAudio.code)
    expect(params.CONTEXT).toBe('LINES')
    expect(params.IFRAME).toBe(env.bitrix.iframeAudio.url)
    expect(params.HASH).toBe(env.bitrix.iframeAudio.hash)
    expect(params.ICON_FILE.length).toBeGreaterThan(100)
    expect(params.LANG[0]?.LANGUAGE_ID).toBe('pt')
    expect(params.LANG[0]?.DESCRIPTION).toContain('audio')
  })

  it('builds imbot.app.update payload with icon and lang', () => {
    const update = buildImbotAudioAppUpdateParams(42)

    expect(update.APP_ID).toBe(42)
    expect(update.ICON_FILE).toBeTruthy()
    expect(update.LANG).toHaveLength(4)
  })
})
