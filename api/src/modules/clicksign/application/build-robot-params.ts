import { env } from '@/config/env'
import { CLICKSIGN_ROBOT_HANDLER_PATH } from '../clicksign.constants'

type RobotProperty = {
  Name: { en: string }
  Description?: { en: string }
  Required: 'Y' | 'N'
  Multiple: 'N'
  Default: string
  Type: 'select'
  Options: Record<string, string>
}

const SIM_NAO: Record<string, string> = { Y: 'Sim', N: 'Não' }

type StaticProperties = {
  token: RobotProperty
  sequencia: RobotProperty
  refusable: RobotProperty
}

function staticProperties(): StaticProperties {
  return {
    token: {
      Name: { en: 'Envio do token' },
      Description: { en: 'Tipo de autenticação para realizar assinatura' },
      Required: 'Y',
      Multiple: 'N',
      Default: '',
      Type: 'select',
      Options: { email: 'Email', sms: 'SMS', whatsapp: 'Whatsapp' },
    },
    sequencia: {
      Name: { en: 'Ativar sequencia' },
      Description: { en: 'Ativa sequencia de assinatura' },
      Required: 'Y',
      Multiple: 'N',
      Default: 'N',
      Type: 'select',
      Options: SIM_NAO,
    },
    refusable: {
      Name: { en: 'Recusar documento?' },
      Description: {
        en: 'Determina se o signatário pode recusar ou não a assinatura do documento.',
      },
      Required: 'Y',
      Multiple: 'N',
      Default: 'N',
      Type: 'select',
      Options: SIM_NAO,
    },
  }
}

// USE_SUBSCRIPTION='Y' pausa a automação até o send-controller chamar
// `bizproc.event.send`.
export function buildClicksignRobotAddParams(): Record<string, unknown> {
  return {
    CODE: env.clicksign.robot.code,
    HANDLER: `${env.apiUrl}${CLICKSIGN_ROBOT_HANDLER_PATH}`,
    USE_SUBSCRIPTION: 'Y',
    NAME: { en: env.clicksign.robot.name },
    DESCRIPTION: { en: 'Enviar documento para assinatura' },
    PROPERTIES: staticProperties(),
    FILTER: { INCLUDE: [['crm', 'CCrmDocumentDeal']] },
  }
}

// groupOptions: `{ idSemEspaco: idOriginal }`; empresaOptions: `{ token: name }`.
export function buildClicksignRobotUpdateParams(
  groupOptions: Record<string, string>,
  empresaOptions: Record<string, string>,
): Record<string, unknown> {
  const properties: Record<string, RobotProperty> = {
    token: staticProperties().token,
    group: {
      Name: { en: 'Grupo de assinatura' },
      Required: 'Y',
      Multiple: 'N',
      Default: '',
      Type: 'select',
      Options: groupOptions,
    },
    sequencia: staticProperties().sequencia,
    refusable: staticProperties().refusable,
  }

  if (Object.keys(empresaOptions).length > 0) {
    properties.empresa = {
      Name: { en: 'Empresa' },
      Description: { en: 'Empresa para assinar o documento' },
      Required: 'Y',
      Multiple: 'N',
      Default: '',
      Type: 'select',
      Options: empresaOptions,
    }
  }

  return {
    CODE: env.clicksign.robot.code,
    FIELDS: { PROPERTIES: properties },
  }
}
