import { env } from '@/config/env'

export type ThinkzapRobotAddParams = {
  CODE: string
  HANDLER: string
  USE_SUBSCRIPTION: string
  NAME: string
  PROPERTIES: {
    connector: {
      Name: string
      Type: string
      Options: Record<string, string>
    }
    destination: {
      Name: string
      Type: string
    }
    sendToAllRelatedContacts: {
      Name: string
      Type: string
      Default: string
    }
    message: {
      Name: string
      Type: string
    }
    file: {
      Name: string
      Type: string
      Multiple: string
    }
  }
}

export function buildThinkzapRobotAddParams(): ThinkzapRobotAddParams {
  const params: ThinkzapRobotAddParams = {
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
      // destination is optional: when sendToAllRelatedContacts is on, it is ignored
      destination: {
        Name: 'Destination',
        Type: 'string',
      },
      sendToAllRelatedContacts: {
        Name: 'Send to all related contacts',
        Type: 'bool',
        Default: 'N',
      },
      message: {
        Name: 'Message',
        Type: 'text',
      },
      // optional: with files, message becomes the caption and may be empty
      file: {
        Name: 'File',
        Type: 'file',
        Multiple: 'Y',
      },
    },
  }

  return params
}

export function buildThinkzapRobotUpdateParams(): {
  CODE: string
  FIELDS: Pick<ThinkzapRobotAddParams, 'PROPERTIES'>
} {
  const addParams = buildThinkzapRobotAddParams()

  return {
    CODE: addParams.CODE,
    FIELDS: {
      PROPERTIES: addParams.PROPERTIES,
    },
  }
}
