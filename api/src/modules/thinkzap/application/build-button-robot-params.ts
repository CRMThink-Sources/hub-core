/**
 * Propriedade de robô, no shape que `bizproc.robot.add` aceita.
 *
 * Mirror do robô de template — mesmo formato, mesma engine.
 */
type RobotProperty = {
  Name: string
  Description?: string
  Type: 'string' | 'text' | 'bool'
  Required?: 'Y' | 'N'
  Multiple?: 'Y' | 'N'
  Default?: string
}

export type ButtonRobotProperties = {
  connector: RobotProperty
  destination: RobotProperty
  sendToAllRelatedContacts: RobotProperty
  body: RobotProperty
  header: RobotProperty
  footer: RobotProperty
  buttons: RobotProperty
}

export type ButtonRobotAddParams = {
  CODE: string
  HANDLER: string
  NAME: string
  DESCRIPTION: string
  USE_SUBSCRIPTION: 'N'
  PROPERTIES: ButtonRobotProperties
  USE_PLACEMENT?: 'Y'
  PLACEMENT_HANDLER?: string
}

/** O que vem de `env.bitrix.buttonRobotOfficial`/`buttonRobotUnofficial`. */
export type ButtonRobotEnvConfig = {
  code: string
  name: string
  handlerUrl: string
  placementUrl: string
}

/**
 * Propriedades comuns aos dois robôs de botão.
 *
 * `buttons` é a propriedade múltipla que carrega cada botão como uma linha
 * `"<tipo>|<label>|<url ou telefone>"` — o terceiro campo fica vazio para
 * `REPLY`, que não usa valor extra. Um property "múltiplo" do Bitrix só
 * carrega uma lista de escalares (mesma limitação de `templateParameters`),
 * então cada entrada é este formato compacto, e o handler do webhook
 * desmonta de volta para `ButtonAction`.
 *
 * Quais tipos são válidos em cada robô (oficial: `URL`/`CALL`; não oficial:
 * `REPLY`/`URL`/`CALL`, sem misturar `REPLY` com os outros) é regra de
 * validação no handler e na tela — não do formato da propriedade, que é o
 * mesmo para os dois.
 */
function buttonRobotProperties(): ButtonRobotProperties {
  return {
    connector: {
      Name: 'Linha do WhatsApp',
      Description: 'Linha que envia a mensagem com botões',
      Type: 'string',
      Required: 'Y',
      Default: '',
    },
    // Ignorado quando `sendToAllRelatedContacts` está ligado — mesma regra dos
    // outros dois robôs.
    destination: {
      Name: 'Destino',
      Description: 'Telefone do destinatário, ou campo do documento',
      Type: 'string',
      Required: 'N',
      Default: '',
    },
    sendToAllRelatedContacts: {
      Name: 'Enviar para todos os contatos relacionados',
      Type: 'bool',
      Required: 'N',
      Default: 'N',
    },
    body: {
      Name: 'Corpo da mensagem',
      Type: 'text',
      Required: 'Y',
      Default: '',
    },
    header: {
      Name: 'Título (opcional)',
      Type: 'string',
      Required: 'N',
      Default: '',
    },
    footer: {
      Name: 'Rodapé (opcional)',
      Type: 'string',
      Required: 'N',
      Default: '',
    },
    buttons: {
      Name: 'Botões',
      Description: 'Um por linha, no formato tipo|label|url-ou-telefone',
      Type: 'string',
      Required: 'N',
      Multiple: 'Y',
      Default: '',
    },
  }
}

/**
 * Payload de `bizproc.robot.add` de um robô de botão.
 *
 * Sem `FILTER`, mesma razão dos outros dois robôs: filtro de tipo de
 * documento tiraria o robô da lista de automação das SPAs.
 */
export function buildButtonRobotAddParams(
  config: ButtonRobotEnvConfig,
  description: string,
): ButtonRobotAddParams {
  const params: ButtonRobotAddParams = {
    CODE: config.code,
    HANDLER: config.handlerUrl,
    NAME: config.name,
    DESCRIPTION: description,
    USE_SUBSCRIPTION: 'N',
    PROPERTIES: buttonRobotProperties(),
  }

  // Sem URL de tela, o robô é registrado sem placement: o Bitrix usa o formulário
  // nativo sobre estas mesmas propriedades.
  if (config.placementUrl) {
    params.USE_PLACEMENT = 'Y'
    params.PLACEMENT_HANDLER = config.placementUrl
  }

  return params
}

/**
 * Payload de `bizproc.robot.update`. `HANDLER` fica de fora — mirror da mesma
 * decisão do robô de template.
 */
export function buildButtonRobotUpdateParams(
  config: ButtonRobotEnvConfig,
  description: string,
): {
  CODE: string
  FIELDS: {
    PROPERTIES: ButtonRobotProperties
    USE_PLACEMENT?: 'Y' | 'N'
    PLACEMENT_HANDLER?: string
  }
} {
  const addParams = buildButtonRobotAddParams(config, description)

  return {
    CODE: addParams.CODE,
    FIELDS: {
      PROPERTIES: addParams.PROPERTIES,
      USE_PLACEMENT: addParams.USE_PLACEMENT ?? 'N',
      ...(addParams.PLACEMENT_HANDLER
        ? { PLACEMENT_HANDLER: addParams.PLACEMENT_HANDLER }
        : {}),
    },
  }
}
