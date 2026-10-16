import { beforeEach, describe, expect, it, vi } from 'vitest'

const { templateRobot } = vi.hoisted(() => ({
  templateRobot: {
    code: 'thinkzap_template_robot',
    name: 'ThinkZap - Enviar template',
    handlerUrl: 'https://api.test/thinkzap/bizproc/template-robot',
    placementUrl: 'https://app.test/bitrix/bizproc/template',
  },
}))

vi.mock('@/config/env', () => ({
  env: { bitrix: { templateRobot } },
}))

import {
  buildTemplateRobotAddParams,
  buildTemplateRobotUpdateParams,
} from './build-template-robot-params'

describe('buildTemplateRobotAddParams', () => {
  beforeEach(() => {
    templateRobot.placementUrl = 'https://app.test/bitrix/bizproc/template'
  })

  it('builds bizproc.robot.add params with the placement screen', () => {
    const params = buildTemplateRobotAddParams()

    expect(params).toMatchObject({
      CODE: 'thinkzap_template_robot',
      HANDLER: 'https://api.test/thinkzap/bizproc/template-robot',
      NAME: 'ThinkZap - Enviar template',
      USE_SUBSCRIPTION: 'N',
      USE_PLACEMENT: 'Y',
      PLACEMENT_HANDLER: 'https://app.test/bitrix/bizproc/template',
    })
  })

  it('declares every property the webhook reads', () => {
    const { PROPERTIES } = buildTemplateRobotAddParams()

    expect(Object.keys(PROPERTIES)).toEqual([
      'connector',
      'destination',
      'sendToAllRelatedContacts',
      'templateName',
      'templateLanguage',
      'templateBody',
      'templateParameters',
      'templateButtonParameters',
    ])
  })

  it('keeps the related-contacts toggle off by default', () => {
    const { PROPERTIES } = buildTemplateRobotAddParams()

    expect(PROPERTIES.sendToAllRelatedContacts).toMatchObject({
      Type: 'bool',
      Default: 'N',
    })
  })

  it('takes the template values as an ordered list', () => {
    const { PROPERTIES } = buildTemplateRobotAddParams()

    expect(PROPERTIES.templateParameters.Multiple).toBe('Y')
  })

  it('takes the dynamic button values as an optional ordered list', () => {
    const { PROPERTIES } = buildTemplateRobotAddParams()

    expect(PROPERTIES.templateButtonParameters).toMatchObject({
      Multiple: 'Y',
      Required: 'N',
    })
  })

  // Sem a tela o robô ainda tem de ser configurável: o Bitrix cai no formulário
  // nativo sobre as mesmas propriedades.
  it('omits placement fields when no screen URL is configured', () => {
    templateRobot.placementUrl = ''

    const params = buildTemplateRobotAddParams()

    expect(params).not.toHaveProperty('USE_PLACEMENT')
    expect(params).not.toHaveProperty('PLACEMENT_HANDLER')
    expect(params.PROPERTIES.connector).toBeDefined()
  })

  it('does not restrict the robot to specific document types', () => {
    expect(buildTemplateRobotAddParams()).not.toHaveProperty('FILTER')
  })
})

describe('buildTemplateRobotUpdateParams', () => {
  beforeEach(() => {
    templateRobot.placementUrl = 'https://app.test/bitrix/bizproc/template'
  })

  it('converges properties and placement, without touching the handler', () => {
    const addParams = buildTemplateRobotAddParams()

    expect(buildTemplateRobotUpdateParams()).toEqual({
      CODE: addParams.CODE,
      FIELDS: {
        PROPERTIES: addParams.PROPERTIES,
        USE_PLACEMENT: 'Y',
        PLACEMENT_HANDLER: 'https://app.test/bitrix/bizproc/template',
      },
    })
  })

  // Portal que já tinha o robô só recebe a propriedade nova por este update.
  it('carries the button values property to existing robots', () => {
    expect(
      buildTemplateRobotUpdateParams().FIELDS.PROPERTIES
        .templateButtonParameters,
    ).toMatchObject({ Multiple: 'Y' })
  })

  // Portal registrado com tela e ambiente que depois a desliga: o update tem de
  // desligar o placement, não deixá-lo apontando para uma URL que não serve mais.
  it('turns the placement off when the screen URL is gone', () => {
    templateRobot.placementUrl = ''

    const { FIELDS } = buildTemplateRobotUpdateParams()

    expect(FIELDS.USE_PLACEMENT).toBe('N')
    expect(FIELDS).not.toHaveProperty('PLACEMENT_HANDLER')
  })

  it('never reinstates a document-type filter', () => {
    expect(buildTemplateRobotUpdateParams().FIELDS).not.toHaveProperty('FILTER')
  })
})
