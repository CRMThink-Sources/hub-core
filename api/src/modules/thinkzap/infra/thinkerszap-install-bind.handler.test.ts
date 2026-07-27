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

vi.mock('../application/build-crm-detail-placement-bind-params', () => ({
  buildCrmDetailPlacementBindParams: () => [
    {
      PLACEMENT: 'CRM_CONTACT_DETAIL_TAB',
      HANDLER: 'https://app.example/widgets/conversations',
      TITLE: 'ThinkZap',
      LANG_ALL: { pt: { TITLE: 'ThinkZap' } },
    },
  ],
}))

vi.mock('../application/build-thinkzap-robot-add-params', () => ({
  buildThinkzapRobotAddParams: () => ({
    CODE: 'thinkzap_robot',
    HANDLER: 'https://app.example/robot',
    USE_SUBSCRIPTION: 'N',
    NAME: 'ThinkZap Robot',
    PROPERTIES: {},
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

  it('includes CRM detail placement binds from builder', () => {
    const binds = handler.getBinds()
    const crmBind = binds.find(
      bind =>
        bind.method === 'placement.bind' &&
        bind.params.PLACEMENT === 'CRM_CONTACT_DETAIL_TAB',
    )

    expect(crmBind?.params).toMatchObject({
      HANDLER: 'https://app.example/widgets/conversations',
    })
  })

  it('includes bizproc robot bind from builder', () => {
    const binds = handler.getBinds()
    const robotBind = binds.find(bind => bind.method === 'bizproc.robot.add')

    expect(robotBind?.params).toMatchObject({
      CODE: 'thinkzap_robot',
      HANDLER: 'https://app.example/robot',
    })
  })

  it('includes ONIMCONNECTORMESSAGEUPDATE event bind when webhookUrl is set', () => {
    vi.stubEnv('BITRIX_WEBHOOK_URL', 'https://app.example/webhook')
    const binds = handler.getBinds()
    const updateBind = binds.find(
      bind =>
        bind.method === 'event.bind' &&
        bind.params.event === 'ONIMCONNECTORMESSAGEUPDATE',
    )

    expect(updateBind).toBeDefined()
    expect(updateBind?.params).toMatchObject({
      event: 'ONIMCONNECTORMESSAGEUPDATE',
      auth_type: '0',
      offline: 0,
    })
    vi.unstubAllEnvs()
  })

  it('includes ONIMCONNECTORMESSAGEDELETE event bind when webhookUrl is set', () => {
    vi.stubEnv('BITRIX_WEBHOOK_URL', 'https://app.example/webhook')
    const binds = handler.getBinds()
    const deleteBind = binds.find(
      bind =>
        bind.method === 'event.bind' &&
        bind.params.event === 'ONIMCONNECTORMESSAGEDELETE',
    )

    expect(deleteBind).toBeDefined()
    expect(deleteBind?.params).toMatchObject({
      event: 'ONIMCONNECTORMESSAGEDELETE',
      auth_type: '0',
      offline: 0,
    })
    vi.unstubAllEnvs()
  })
})
