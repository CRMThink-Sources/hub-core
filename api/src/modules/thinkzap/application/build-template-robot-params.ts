import { env } from '@/config/env'

/**
 * Propriedade de robô, no shape que `bizproc.robot.add` aceita.
 *
 * `Multiple` só aparece em `templateParameters` e `templateButtonParameters`: são as
 * propriedades que carregam lista, e o Bitrix trata a ausência da chave como `'N'`.
 */
type RobotProperty = {
  Name: string
  Description?: string
  Type: 'string' | 'text' | 'bool'
  Required?: 'Y' | 'N'
  Multiple?: 'Y' | 'N'
  Default?: string
}

export type TemplateRobotProperties = {
  connector: RobotProperty
  destination: RobotProperty
  sendToAllRelatedContacts: RobotProperty
  templateName: RobotProperty
  templateLanguage: RobotProperty
  templateBody: RobotProperty
  templateParameters: RobotProperty
  templateButtonParameters: RobotProperty
}

export type TemplateRobotAddParams = {
  CODE: string
  HANDLER: string
  NAME: string
  DESCRIPTION: string
  USE_SUBSCRIPTION: 'N'
  PROPERTIES: TemplateRobotProperties
  USE_PLACEMENT?: 'Y'
  PLACEMENT_HANDLER?: string
}

/**
 * Propriedades do robô de template.
 *
 * Continuam declaradas mesmo com a tela própria ligada, por duas razões que valem
 * mais que a feiura do formulário nativo: o payload do webhook só carrega o que está
 * em `PROPERTIES` — a tela grava valores, quem os entrega ao handler é a declaração —
 * e, se a tela não carregar no portal, o Bitrix cai no formulário nativo e o robô
 * continua configurável em vez de virar um passo de automação inerte.
 *
 * `Type: 'string'` em `connector` e não `select` com `Options`: a lista de linhas é
 * lida pela tela, fresca, direto da nossa API. Sincronizar opções na definição do
 * robô — o que `syncThinkzapRobotConnectorOptions` faz para o robô de envio livre —
 * acoplaria o ciclo de vida do robô ao de cada provisionamento de conector.
 */
function templateRobotProperties(): TemplateRobotProperties {
  return {
    connector: {
      Name: 'Linha do WhatsApp Oficial',
      Description: 'Linha que envia o template',
      Type: 'string',
      Required: 'Y',
      Default: '',
    },
    // Ignorado quando `sendToAllRelatedContacts` está ligado — mesma regra do robô
    // de envio livre.
    destination: {
      Name: 'Destino',
      Description: 'Telefone do destinatário, ou campo do documento',
      Type: 'string',
      Required: 'N',
      Default: '',
    },
    sendToAllRelatedContacts: {
      Name: 'Enviar para todos os contatos relacionados',
      Description:
        'Cada destinatário resolvido consome um template cobrado pela Meta',
      Type: 'bool',
      Required: 'N',
      Default: 'N',
    },
    templateName: {
      Name: 'Template',
      Description: 'Nome do template aprovado',
      Type: 'string',
      Required: 'Y',
      Default: '',
    },
    templateLanguage: {
      Name: 'Idioma do template',
      Type: 'string',
      Required: 'Y',
      Default: '',
    },
    /**
     * Corpo cru do template, gravado pela tela na configuração.
     *
     * Existe para o **registro**, não para o envio: o outbox precisa do texto
     * resolvido na hora de gravar a intenção, e buscá-lo no provider poria uma
     * chamada remota — e uma falha possível — no caminho de cada execução de
     * workflow. Vazio cai no fallback de listagem por nome e idioma.
     */
    templateBody: {
      Name: 'Corpo do template',
      Description: 'Preenchido pela tela de configuração',
      Type: 'text',
      Required: 'N',
      Default: '',
    },
    templateParameters: {
      Name: 'Valores das variáveis',
      Description: 'Na ordem em que as variáveis aparecem no corpo',
      Type: 'string',
      Required: 'N',
      Multiple: 'Y',
      Default: '',
    },
    /**
     * Um valor por botão dinâmico (link com variável ou copiar código), na ordem em
     * que esses botões aparecem no template. O handler amarra cada valor ao `index`
     * do botão pelo catálogo — o Bitrix só guarda a ordem.
     */
    templateButtonParameters: {
      Name: 'Valores dos botões',
      Description: 'Na ordem em que os botões dinâmicos aparecem no template',
      Type: 'string',
      Required: 'N',
      Multiple: 'Y',
      Default: '',
    },
  }
}

/**
 * Payload de `bizproc.robot.add` do robô de template.
 *
 * Sem `FILTER`, pelo mesmo motivo do robô de envio livre: filtro de tipo de documento
 * some com o robô da lista de automação das SPAs, e template é justamente o que se
 * dispara de processo de negócio.
 *
 * `USE_SUBSCRIPTION: 'N'` — o workflow não espera a entrega. Quem garante a entrega é
 * o outbox, e prender o passo da automação até o provider responder transformaria uma
 * indisponibilidade de minutos em workflow travado.
 */
export function buildTemplateRobotAddParams(): TemplateRobotAddParams {
  const params: TemplateRobotAddParams = {
    CODE: env.bitrix.templateRobot.code,
    HANDLER: env.bitrix.templateRobot.handlerUrl,
    NAME: env.bitrix.templateRobot.name,
    DESCRIPTION:
      'Envia um template aprovado do WhatsApp Oficial pela linha escolhida',
    USE_SUBSCRIPTION: 'N',
    PROPERTIES: templateRobotProperties(),
  }

  // Sem URL de tela, o robô é registrado sem placement: o Bitrix usa o formulário
  // nativo sobre estas mesmas propriedades.
  if (env.bitrix.templateRobot.placementUrl) {
    params.USE_PLACEMENT = 'Y'
    params.PLACEMENT_HANDLER = env.bitrix.templateRobot.placementUrl
  }

  return params
}

/**
 * Payload de `bizproc.robot.update`.
 *
 * Carrega `USE_PLACEMENT`/`PLACEMENT_HANDLER` junto de `PROPERTIES` porque é por este
 * caminho que um portal registrado antes da tela — ou antes de a URL existir no
 * ambiente — converge para a configuração atual. `HANDLER` fica de fora: mudar o
 * destino do webhook de um robô já instalado não é convergência de definição, é troca
 * de rota, e merece um passo próprio.
 */
export function buildTemplateRobotUpdateParams(): {
  CODE: string
  FIELDS: {
    PROPERTIES: TemplateRobotProperties
    USE_PLACEMENT?: 'Y' | 'N'
    PLACEMENT_HANDLER?: string
  }
} {
  const addParams = buildTemplateRobotAddParams()

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
