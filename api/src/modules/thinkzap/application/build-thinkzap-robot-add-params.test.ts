import { describe, expect, it } from 'vitest'
import { env } from '@/config/env'
import {
  buildThinkzapRobotAddParams,
  buildThinkzapRobotUpdateParams,
} from './build-thinkzap-robot-add-params'

describe('buildThinkzapRobotAddParams', () => {
  it('builds bizproc.robot.add params from env', () => {
    const params = buildThinkzapRobotAddParams()

    expect(params).toMatchObject({
      CODE: env.bitrix.robot.code,
      HANDLER: env.bitrix.robot.handlerUrl,
      USE_SUBSCRIPTION: 'N',
      NAME: env.bitrix.robot.name,
      PROPERTIES: {
        connector: {
          Name: 'Connector',
          Type: 'select',
          Options: {},
        },
        destination: {
          Name: 'Destination',
          Type: 'string',
        },
        sendToAllRelatedContacts: {
          Name: 'Send to all related contacts',
          Type: 'bool',
          Default: 'N',
        },
      },
    })
  })

  it('does not restrict the robot to specific document types', () => {
    const params = buildThinkzapRobotAddParams()

    expect(params).not.toHaveProperty('FILTER')
  })

  it('builds bizproc.robot.update params from add params', () => {
    const addParams = buildThinkzapRobotAddParams()
    const updateParams = buildThinkzapRobotUpdateParams()

    expect(updateParams).toEqual({
      CODE: addParams.CODE,
      FIELDS: {
        PROPERTIES: addParams.PROPERTIES,
      },
    })
  })
})
