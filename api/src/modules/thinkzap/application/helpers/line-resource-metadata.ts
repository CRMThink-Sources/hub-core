import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { ProvisionedConnectorResource } from '@/modules/thinkzap/domain/ports/whatsapp-connector-provider.port'

export class ProvisionedResourceWithoutCredentialError extends Error {
  constructor(provider: ConnectorProvider) {
    super(
      provider === ConnectorProvider.HUBMESSAGE
        ? 'O provisionamento do WhatsApp Oficial não devolveu o id do canal, e sem ele a ' +
            'linha não identifica recurso nenhum. Nada foi cobrado. Tente novamente.'
        : 'O provisionamento do WhatsApp Web não devolveu o token da instância, e a linha ' +
            'sem credencial nunca conectaria. Nada foi cobrado. Tente novamente.',
    )
    this.name = 'ProvisionedResourceWithoutCredentialError'
  }
}

/**
 * A credencial de um recurso recém-provisionado, no formato que o item da SPA espera.
 *
 * Vive num helper porque **três** fluxos criam linha — trial, criação em assinatura
 * paga e ativação que acrescenta linha — e uma cópia por fluxo divergiria: o dia em
 * que um provider passar a devolver a credencial em outro campo, dois dos três
 * continuariam gravando `NONE` sem erro.
 *
 * Falta de credencial é **erro**, não item `NONE`: uma linha sem credencial nunca
 * conectaria, e o cliente teria pago por ela.
 *
 * **A WABA não é credencial de criação.** O provisionamento do HubMessage devolve o
 * canal e nada mais — a WABA só existe depois de o cliente conectar o número na Meta,
 * e chega em `POST /connector/connect-channel`. Exigi-la aqui tornava a linha do
 * WhatsApp Oficial impossível de criar por qualquer caminho, trial incluído.
 */
export function toLineMetadata(
  provider: ConnectorProvider,
  resource: Pick<
    ProvisionedConnectorResource,
    'instanceId' | 'zApiToken' | 'channelId' | 'wabaId'
  >,
): SubscriptionItem['metadata'] {
  if (provider === ConnectorProvider.HUBMESSAGE) {
    const channelId = resource.channelId ?? resource.instanceId
    if (!channelId) {
      throw new ProvisionedResourceWithoutCredentialError(provider)
    }

    return {
      provider: 'HUBMESSAGE',
      hubmessageChannelId: channelId,
      /**
       * Presente só quando o provider já a conhece — hoje nunca, no provisionamento.
       * Fica no contrato porque a retomada idempotente (`existingRemoteId`) pode
       * reprovisionar um canal já conectado.
       */
      ...(resource.wabaId ? { wabaId: resource.wabaId } : {}),
    }
  }

  if (!resource.zApiToken) {
    throw new ProvisionedResourceWithoutCredentialError(provider)
  }

  return {
    provider: 'ZAPI',
    zApiInstanceId: resource.instanceId,
    zApiInstanceToken: resource.zApiToken,
  }
}

/** O identificador remoto do recurso, para o log de recurso órfão. */
export const resourceRefOf = (
  provider: ConnectorProvider,
  resource: Pick<ProvisionedConnectorResource, 'instanceId' | 'channelId'>,
): string =>
  provider === ConnectorProvider.HUBMESSAGE
    ? (resource.channelId ?? resource.instanceId)
    : resource.instanceId

/**
 * A base do nome gerado, por conector.
 *
 * Um lugar só: `lineNameFor`, o nome do trial e `isGeneratedLineName` derivam
 * todos daqui. Enquanto a base estava copiada, o predicado podia deixar de
 * reconhecer um nome que a criação continuava produzindo — e o backfill trataria
 * como "cliente já renomeou" um item que ninguém tocou.
 */
export const lineNameBase = (provider: ConnectorProvider): string =>
  provider === ConnectorProvider.HUBMESSAGE ? 'WhatsApp Oficial' : 'WhatsApp'

/** O nome da linha, derivado do conector. */
export function lineNameFor(
  provider: ConnectorProvider,
  order: number,
): string {
  const base = lineNameBase(provider)

  /**
   * Sufixo de ordem só da segunda em diante: a primeira linha da instalação não
   * precisa de número, e numerar todas faria a linha existente parecer renomeada.
   */
  return order > 1 ? `${base} ${order}` : base
}

/** O nome da linha que nasce de um trial. */
export const trialLineNameFor = (provider: ConnectorProvider): string =>
  `${lineNameBase(provider)} (teste)`

/**
 * O nome ainda é o que a criação gerou — ninguém o ajustou.
 *
 * Existe para o backfill que traz para o item os nomes que só existiam na Z-API:
 * ele só pode escrever onde o `title` continua sendo o gerado, sob pena de apagar
 * o nome de quem editou o item direto no CRM.
 *
 * O guard é o **formato**, e não "o campo está vazio": `createSubscriptionItem`
 * nunca deixa o nome vazio, então ausência não distingue nada.
 */
export function isGeneratedLineName(
  name: string,
  provider: ConnectorProvider,
): boolean {
  const base = lineNameBase(provider)

  /** `WhatsApp`, `WhatsApp 2`, `WhatsApp (teste)` — e as variantes de "Oficial". */
  const generated = new RegExp(
    `^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?: \\d+| \\(teste\\))?$`,
  )

  return generated.test(name.trim())
}
