import { describe, expect, it } from 'vitest'
import {
  buildButtonRobotAddParams,
  buildButtonRobotUpdateParams,
} from './build-button-robot-params'

const config = () => ({
  code: 'thinkzap_button_robot_official',
  name: 'ThinkZap - Enviar botões (WhatsApp Oficial)',
  handlerUrl: 'https://api.test/thinkzap/bizproc/button-robot-official',
  placementUrl: 'https://app.test/bitrix/bizproc/button-official',
})

describe('buildButtonRobotAddParams', () => {
  it('builds bizproc.robot.add params with the placement screen', () => {
    const params = buildButtonRobotAddParams(config(), 'uma descrição')

    expect(params).toMatchObject({
      CODE: 'thinkzap_button_robot_official',
      HANDLER: 'https://api.test/thinkzap/bizproc/button-robot-official',
      NAME: 'ThinkZap - Enviar botões (WhatsApp Oficial)',
      DESCRIPTION: 'uma descrição',
      USE_SUBSCRIPTION: 'N',
      USE_PLACEMENT: 'Y',
      PLACEMENT_HANDLER: 'https://app.test/bitrix/bizproc/button-official',
    })
  })

  it('declares every property the webhook reads', () => {
    const { PROPERTIES } = buildButtonRobotAddParams(config(), 'x')

    expect(Object.keys(PROPERTIES)).toEqual([
      'connector',
      'destination',
      'sendToAllRelatedContacts',
      'body',
      'header',
      'footer',
      'buttons',
    ])
  })

  it('keeps the related-contacts toggle off by default', () => {
    const { PROPERTIES } = buildButtonRobotAddParams(config(), 'x')

    expect(PROPERTIES.sendToAllRelatedContacts).toMatchObject({
      Type: 'bool',
      Default: 'N',
    })
  })

  it('takes the buttons as an ordered multiple property', () => {
    const { PROPERTIES } = buildButtonRobotAddParams(config(), 'x')

    expect(PROPERTIES.buttons.Multiple).toBe('Y')
  })

  it('omits placement fields when no screen URL is configured', () => {
    const params = buildButtonRobotAddParams(
      { ...config(), placementUrl: '' },
      'x',
    )

    expect(params).not.toHaveProperty('USE_PLACEMENT')
    expect(params).not.toHaveProperty('PLACEMENT_HANDLER')
    expect(params.PROPERTIES.connector).toBeDefined()
  })

  it('does not restrict the robot to specific document types', () => {
    expect(buildButtonRobotAddParams(config(), 'x')).not.toHaveProperty(
      'FILTER',
    )
  })
})

describe('buildButtonRobotUpdateParams', () => {
  it('converges properties and placement, without touching the handler', () => {
    const addParams = buildButtonRobotAddParams(config(), 'x')

    expect(buildButtonRobotUpdateParams(config(), 'x')).toEqual({
      CODE: addParams.CODE,
      FIELDS: {
        PROPERTIES: addParams.PROPERTIES,
        USE_PLACEMENT: 'Y',
        PLACEMENT_HANDLER: 'https://app.test/bitrix/bizproc/button-official',
      },
    })
  })

  it('turns the placement off when the screen URL is gone', () => {
    const { FIELDS } = buildButtonRobotUpdateParams(
      { ...config(), placementUrl: '' },
      'x',
    )

    expect(FIELDS.USE_PLACEMENT).toBe('N')
    expect(FIELDS).not.toHaveProperty('PLACEMENT_HANDLER')
  })

  it('never reinstates a document-type filter', () => {
    expect(
      buildButtonRobotUpdateParams(config(), 'x').FIELDS,
    ).not.toHaveProperty('FILTER')
  })
})
