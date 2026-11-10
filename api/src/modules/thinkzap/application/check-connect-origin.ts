import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { HubMessageClient } from '@/modules/thinkzap/infra/clients/hubmessage.client'
import { apiLogger } from '@/shared/infra/logger'
import { assertEnabledOfficialLineInContext } from './helpers/resolve-line-by-subscription-item'

export type CheckConnectOriginInput = {
  subscriptionItemId: string
  domainId: string
  appCode: string
  /** Origem já normalizada (`protocolo://host[:porta]`) da página que abrirá o SDK. */
  origin: string
}

export type CheckConnectOriginResult = { allowed: boolean }

const normalizeOrigin = (origin: string) => origin.replace(/\/$/, '')

/**
 * Pré-checagem de origem da conexão do canal oficial, feita no servidor.
 *
 * O SDK aborta em silêncio quando a origem da página não está na allowlist do canal;
 * consultar `sdk-info` antes permite dizer ao usuário o motivo real. A consulta roda
 * aqui, e não no navegador, porque a rede de alguns clientes alcança o nosso servidor
 * mas não a Omni.
 *
 * Não é fronteira de segurança — quem aplica a allowlist é a Omni, no SDK. Por isso
 * qualquer falha da consulta libera o fluxo (`allowed: true`): a checagem nunca pode
 * bloquear uma conexão que o SDK aceitaria.
 */
export class CheckConnectOrigin {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly hubMessageClient: Pick<HubMessageClient, 'getSdkInfo'>,
  ) {}

  async execute(
    input: CheckConnectOriginInput,
    now: Date = new Date(),
  ): Promise<CheckConnectOriginResult> {
    const context = await this.getAplicationContext.execute({
      domainId: input.domainId,
      appCode: input.appCode,
    })

    // Linha bloqueada é recusada aqui: `connect-channel` a recusaria de qualquer forma,
    // e assim o cliente não passa pela autenticação Meta à toa.
    const line = assertEnabledOfficialLineInContext(
      context,
      input.subscriptionItemId,
      now,
    )

    try {
      const info = await this.hubMessageClient.getSdkInfo(line.channelId)
      const allowed = (info?.allowOrigins ?? []).map(normalizeOrigin)

      if (allowed.length === 0) return { allowed: true }

      return { allowed: allowed.includes(normalizeOrigin(input.origin)) }
    } catch (error) {
      apiLogger.warn(
        {
          app: 'thinkzap',
          itemId: line.item.id,
          channelId: line.channelId,
          err: error,
        },
        'Checagem de origem da conexão liberada: sdk-info indisponível',
      )

      return { allowed: true }
    }
  }
}
