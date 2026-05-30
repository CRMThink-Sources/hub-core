import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../application/build-audio-im-textarea-placement-params', () => ({
  buildAudioImTextareaPlacementBindParams: () => ({
    PLACEMENT: 'IM_TEXTAREA',
    HANDLER: 'https://app.example/bitrix/widget/audio',
    TITLE: 'ThinkZap Audio',
    LANG_ALL: { pt: { TITLE: 'ThinkZap Audio' } },
    OPTIONS: { iconName: 'chat-compose', context: 'LINES' },
  }),
}))

import { ThinkersZapInstallBindHandler } from './thinkerszap-install-bind.handler'

describe('ThinkersZapInstallBindHandler', () => {
  const handler = new ThinkersZapInstallBindHandler()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('includes IM_TEXTAREA placement bind in static binds', () => {
    const binds = handler.getBinds()
    const audioBind = binds.find(
      bind =>
        bind.method === 'placement.bind' &&
        bind.params.PLACEMENT === 'IM_TEXTAREA',
    )

    expect(audioBind).toBeDefined()
    expect(audioBind?.params).toMatchObject({
      PLACEMENT: 'IM_TEXTAREA',
      OPTIONS: {
        iconName: 'chat-compose',
        context: 'LINES',
      },
    })
  })
})
